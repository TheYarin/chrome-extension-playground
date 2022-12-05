async function updateTabCountBadge() {
  const tabs = await chrome.tabs.query({});

  chrome.action.setBadgeText({ text: tabs.length.toString() });
}

chrome.tabs.onCreated.addListener(updateTabCountBadge);
chrome.tabs.onRemoved.addListener(updateTabCountBadge);

updateTabCountBadge();

////////////////////////////////

async function groupClickedGoogleSearchResultTabs(tab: chrome.tabs.Tab) {
  console.log("New tab opened", { tab });

  if (!tab.id || tab.id === chrome.tabs.TAB_ID_NONE) {
    console.warn("Triggered for an invalid tab id, weird!", { tabId: tab.id });
    return;
  }

  // Exclude new-tab tabs
  if (tab.pendingUrl === "chrome://newtab/") return;

  const openerTabId = tab.openerTabId;

  if (!openerTabId) return;

  const openerTab = await chrome.tabs.get(openerTabId);

  const isFromGoogleSearch = openerTab.url?.startsWith("https://www.google.com/search?q=");

  if (!isFromGoogleSearch) return;

  const openerInTabGroupAlready = openerTab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE;

  if (openerInTabGroupAlready) {
    await chrome.tabs.group({ groupId: openerTab.groupId, tabIds: [tab.id] });
  } else {
    const newTabGroupId = await chrome.tabs.group({ tabIds: [tab.id, openerTabId] });
    const newTabGroupName = new URL(openerTab.url!).searchParams.get("q") ?? "";

    if (!newTabGroupName)
      console.warn("Failed to parse the new tabGroup name from the google search query", { openerTab, url: openerTab.url });

    chrome.tabGroups.update(newTabGroupId, { title: newTabGroupName });
  }
}

chrome.tabs.onCreated.addListener(groupClickedGoogleSearchResultTabs);

////////////////////////////////

async function createNewGroup() {
  const newTab = await chrome.tabs.create({});

  if (!newTab.id || newTab.id === chrome.tabs.TAB_ID_NONE) {
    console.warn("The ID of the newly created tab is invalid, weird!", { tabId: newTab.id });
    return;
  }

  await chrome.tabs.group({ tabIds: [newTab.id] });
}

chrome.commands.onCommand.addListener(async (command) => {
  console.log(`Received command`, { command });

  if (command === "create-tabGroup") await createNewGroup();
  else console.error("An unknown command was received", { command });
});
