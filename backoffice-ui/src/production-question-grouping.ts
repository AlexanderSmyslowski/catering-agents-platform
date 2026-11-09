import { menuCategoryQuestion, productionModeQuestion } from "./production-question-language-state.js";

/** Group only uniquely named current dishes; ambiguous labels retain their individual questions. */
export function groupDishQuestions(spec: Record<string, unknown> | undefined, questions: string[]) {
  const menu = Array.isArray(spec?.menuPlan) ? spec.menuPlan as Array<Record<string, unknown>> : [];
  const components = menu.filter(item => {
    const label = typeof item?.label === "string" ? item.label : "";
    const id = typeof item?.componentId === "string" ? item.componentId : "";
    return Boolean(label && id && menu.filter(other => other?.label === label).length === 1 &&
      (questions.includes(menuCategoryQuestion(label)) || questions.includes(productionModeQuestion(label))));
  });
  const texts = components.flatMap(item => [menuCategoryQuestion(String(item.label)), productionModeQuestion(String(item.label))].filter(text => questions.includes(text)));
  return { components, texts, openCount: questions.length - texts.length + components.length };
}
