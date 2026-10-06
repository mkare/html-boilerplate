const copyButton = document.getElementById("copy-stack");
const feedback = document.getElementById("copy-feedback");
const stackSummary = "HTML5, Pug, SCSS, Webpack, native browser APIs, accessible progressive enhancement";

copyButton?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(stackSummary);
    feedback.textContent = "Stack summary copied to clipboard.";
  } catch {
    feedback.textContent = stackSummary;
  }
});
