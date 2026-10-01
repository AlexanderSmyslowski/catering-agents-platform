"""Verify the exported OCI index, platform manifest and config as separate identities."""
from __future__ import annotations

import hashlib
import json
import re
import tarfile
from pathlib import Path

DIGEST = re.compile(r"sha256:[0-9a-f]{64}\Z")
INDEX = "application/vnd.oci.image.index.v1+json"
MANIFEST = "application/vnd.oci.image.manifest.v1+json"
CONFIG = "application/vnd.oci.image.config.v1+json"
PLATFORM = {"os": "linux", "architecture": "amd64"}
UNKNOWN = {"os": "unknown", "architecture": "unknown"}
IMAGE_KEYS = {"archive", "indexDigest", "platformManifestDigest", "configDigest", "services"}


class ArchiveError(ValueError):
    """The archive cannot prove the bound R/M/C relation."""


def require(condition):
    if not condition:
        raise ArchiveError("OCI archive identity or structure is invalid")


def decode(data):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result)
            result[key] = value
        return result
    return json.loads(data, object_pairs_hook=pairs)


def inspect_archive(path: Path, build_iid: str | None = None) -> dict[str, str]:
    """R hashes index.json bytes; M alone is the runnable immutable reference."""
    try:
        with tarfile.open(path, "r:gz") as archive:
            members = {}
            for member in archive.getmembers():
                name = member.name
                require(name not in members)
                require(not name.startswith("/") and all(part not in {"", ".", ".."} for part in name.rstrip("/").split("/")))
                if member.isdir():
                    require(name.rstrip("/") in {"blobs", "blobs/sha256"})
                else:
                    require(member.isfile())
                    require(name in {"index.json", "manifest.json", "oci-layout"} or re.fullmatch(r"blobs/sha256/[0-9a-f]{64}", name))
                members[name] = member
            visited = set()

            def read(name):
                require(name in members and members[name].isfile())
                visited.add(name)
                with archive.extractfile(members[name]) as stream:
                    return stream.read()

            def blob(descriptor, *, payload=True):
                require(isinstance(descriptor, dict) and set(descriptor) <= {"mediaType", "digest", "size", "platform", "annotations"})
                digest, size = descriptor.get("digest"), descriptor.get("size")
                require(isinstance(digest, str) and DIGEST.fullmatch(digest) and type(size) is int and size >= 0)
                require(isinstance(descriptor.get("mediaType"), str))
                if "annotations" in descriptor:
                    require(isinstance(descriptor["annotations"], dict) and all(isinstance(k, str) and isinstance(v, str) for k, v in descriptor["annotations"].items()))
                name = "blobs/sha256/" + digest[7:]
                require(name in members and members[name].isfile() and members[name].size == size)
                visited.add(name)
                result = []
                hasher = hashlib.sha256()
                with archive.extractfile(members[name]) as stream:
                    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                        hasher.update(chunk)
                        if payload: result.append(chunk)
                require("sha256:" + hasher.hexdigest() == digest)
                return b"".join(result)

            require(decode(read("oci-layout")) == {"imageLayoutVersion": "1.0.0"})
            index_bytes = read("index.json")
            roots = []
            selected = []
            attestations = []

            def image(descriptor, *, root=False):
                data = decode(blob(descriptor))
                require(isinstance(data, dict) and type(data.get("schemaVersion")) is int and data["schemaVersion"] == 2)
                require(data.get("mediaType") == descriptor["mediaType"])
                if descriptor["mediaType"] == INDEX:
                    require(root and "platform" not in descriptor)
                    index(data, nested=True)
                    return
                require(descriptor["mediaType"] == MANIFEST)
                require(set(data) == {"schemaVersion", "mediaType", "config", "layers"})
                is_attestation = descriptor.get("platform") == UNKNOWN
                if is_attestation:
                    require(set(descriptor.get("annotations", {})) == {"vnd.docker.reference.type", "vnd.docker.reference.digest"})
                    require(descriptor["annotations"]["vnd.docker.reference.type"] == "attestation-manifest")
                    attestations.append(descriptor)
                else:
                    require(descriptor.get("platform") == PLATFORM or (root and "platform" not in descriptor))
                    require(not any(key.startswith("vnd.docker.reference.") for key in descriptor.get("annotations", {})))
                config = data["config"]
                require(isinstance(config, dict) and config.get("mediaType") == CONFIG and set(config) == {"mediaType", "digest", "size"})
                config_data = decode(blob(config))
                require(isinstance(config_data, dict))
                platform = UNKNOWN if is_attestation else PLATFORM
                require(config_data.get("os") == platform["os"] and config_data.get("architecture") == platform["architecture"] and "variant" not in config_data)
                layers = data["layers"]
                require(isinstance(layers, list))
                for layer in layers:
                    require(isinstance(layer, dict) and "platform" not in layer)
                    require(layer.get("mediaType") in ({"application/vnd.in-toto+json"} if is_attestation else {"application/vnd.oci.image.layer.v1.tar", "application/vnd.oci.image.layer.v1.tar+gzip", "application/vnd.oci.image.layer.v1.tar+zstd"}))
                    blob(layer, payload=False)
                if not is_attestation:
                    selected.append((descriptor["digest"], config["digest"], ["blobs/sha256/" + layer["digest"][7:] for layer in layers]))

            def index(data, *, nested=False):
                require(isinstance(data, dict) and set(data) <= {"schemaVersion", "mediaType", "manifests", "annotations"})
                require(type(data.get("schemaVersion")) is int and data["schemaVersion"] == 2 and data.get("mediaType") == INDEX)
                descriptors = data.get("manifests")
                require(isinstance(descriptors, list) and len(descriptors) > 0)
                if not nested: require(len(descriptors) == 1)
                for descriptor in descriptors:
                    require(isinstance(descriptor, dict))
                    if not nested: roots.append(descriptor.get("digest"))
                    image(descriptor, root=not nested)

            index(decode(index_bytes))
            require(len(selected) == 1)
            m, c, layers = selected[0]
            for descriptor in attestations:
                require(descriptor["annotations"]["vnd.docker.reference.digest"] == m)
            if build_iid is not None:
                require(isinstance(build_iid, str) and DIGEST.fullmatch(build_iid) and build_iid in roots)
            legacy = decode(read("manifest.json"))
            require(isinstance(legacy, list) and len(legacy) == 1 and isinstance(legacy[0], dict))
            require(set(legacy[0]) <= {"Config", "RepoTags", "Layers"})
            require(legacy[0].get("Config") == "blobs/sha256/" + c[7:] and legacy[0].get("Layers") == layers)
            tags = legacy[0].get("RepoTags")
            require(tags is None or isinstance(tags, list) and all(isinstance(tag, str) for tag in tags))
            require(visited == {name for name, member in members.items() if member.isfile()})
            return {"indexDigest": "sha256:" + hashlib.sha256(index_bytes).hexdigest(), "platformManifestDigest": m, "configDigest": c}
    except ArchiveError:
        raise
    except (OSError, EOFError, tarfile.TarError, ValueError, KeyError, TypeError, UnicodeError, AttributeError) as exc:
        raise ArchiveError("OCI archive is invalid or unreadable") from exc


def verify_image(path: Path, image: dict) -> None:
    require(isinstance(image, dict) and set(image) == IMAGE_KEYS)
    actual = inspect_archive(path)
    require(all(image[key] == value for key, value in actual.items()))


def check_loaded_image(value: dict, expected_m: str) -> None:
    """Bind Docker's image observation to the manifest requested by the caller."""
    require(isinstance(expected_m, str) and DIGEST.fullmatch(expected_m))
    require(isinstance(value, dict) and value.get("Id") == expected_m)
    require(value.get("Os") == "linux" and value.get("Architecture") == "amd64" and value.get("Variant", "") == "")
    if "Descriptor" in value:
        require(isinstance(value["Descriptor"], dict) and value["Descriptor"].get("digest") == expected_m)


def check_running_container(value: dict, expected_m: str) -> None:
    """A matching requested tag is insufficient; observe the running image digest."""
    require(isinstance(expected_m, str) and DIGEST.fullmatch(expected_m))
    require(isinstance(value, dict) and value.get("Image") == expected_m)
    require(isinstance(value.get("State"), dict) and value["State"].get("Running") is True)
    if "ImageManifestDescriptor" in value:
        require(isinstance(value["ImageManifestDescriptor"], dict) and value["ImageManifestDescriptor"].get("digest") == expected_m)


def main() -> int:
    import argparse
    import sys
    parser = argparse.ArgumentParser(description="Validate an observed immutable OCI runtime identity")
    parser.add_argument("action", choices=("validate-loaded", "validate-running"))
    parser.add_argument("manifest_digest")
    args = parser.parse_args()
    try:
        value = decode(sys.stdin.read())
        if args.action == "validate-loaded":
            check_loaded_image(value, args.manifest_digest)
        else:
            check_running_container(value, args.manifest_digest)
    except (ValueError, TypeError, UnicodeError, OSError):
        print("OCI runtime identity validation failed", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
