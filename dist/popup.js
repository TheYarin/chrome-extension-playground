// console.log(chrome.tabs);
// alert("popup.js loaded");
const commands = await chrome.commands.getAll();
let html = "";
for (const command of commands) {
    html += `<tr><td>${command.name}</td><td>${command.shortcut}</td><td>${command.description}</td></tr>`;
}
html = `<table><thead><tr><th>NAME</th><th>SHORTCUT</th><th>DESCRIPTION</th></tr></thead><tbody>${html}</tbody></table>`;
document.getElementById("shortcuts").innerHTML = html;
const tabsInCurrentWindow = await chrome.tabs.query({ currentWindow: true });
document.getElementById("tabs-in-current-window").innerHTML = tabsInCurrentWindow.length.toString();
export {};
