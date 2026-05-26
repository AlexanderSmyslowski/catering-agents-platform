import { useState } from "react";
import { buildManualSpecInput } from "./production-manual-spec-input.js";

export function useProductionManualSpecForm() {
  const [manualEventType, setManualEventType] = useState("conference");
  const [manualEventDate, setManualEventDate] = useState("");
  const [manualAttendeeCount, setManualAttendeeCount] = useState("");
  const [manualServiceForm, setManualServiceForm] = useState("buffet");
  const [manualMenuItems, setManualMenuItems] = useState("");
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [manualVenueName, setManualVenueName] = useState("");
  const [manualNotes, setManualNotes] = useState("");

  function buildCurrentManualSpecInput() {
    return buildManualSpecInput({
      eventType: manualEventType,
      eventDate: manualEventDate,
      attendeeCount: manualAttendeeCount,
      serviceForm: manualServiceForm,
      menuItems: manualMenuItems,
      customerName: manualCustomerName,
      venueName: manualVenueName,
      notes: manualNotes
    });
  }

  function resetManualSpecDraft() {
    setManualEventDate("");
    setManualAttendeeCount("");
    setManualMenuItems("");
    setManualCustomerName("");
    setManualVenueName("");
    setManualNotes("");
  }

  return {
    manualEventType,
    manualEventDate,
    manualAttendeeCount,
    manualServiceForm,
    manualMenuItems,
    manualCustomerName,
    manualVenueName,
    manualNotes,
    setManualEventType,
    setManualEventDate,
    setManualAttendeeCount,
    setManualServiceForm,
    setManualMenuItems,
    setManualCustomerName,
    setManualVenueName,
    setManualNotes,
    buildCurrentManualSpecInput,
    resetManualSpecDraft
  };
}
