// Content script for SmartInterview AI
// This script is injected into web pages to facilitate interaction with the interview platforms.

console.log("SmartInterview AI Content Script Loaded");

// Listen for messages from the extension sidepanel/background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ping") {
    sendResponse({ status: "alive" });
  }
  // Future expansion: DOM manipulation helpers can go here
});
