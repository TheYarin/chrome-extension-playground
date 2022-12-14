"use strict";
async function updateTabCountBadge() {
    const tabs = await chrome.tabs.query({});
    chrome.action.setBadgeText({ text: tabs.length.toString() });
}
chrome.tabs.onCreated.addListener(updateTabCountBadge);
chrome.tabs.onRemoved.addListener(updateTabCountBadge);
updateTabCountBadge();
function parseUrlByStartAndSearchParam(urlStart, searchParamName, url, loggingContext) {
    const searchParams = new URL(url).searchParams;
    const wasSearchPageDetected = url.startsWith(urlStart) && searchParams.has(searchParamName);
    if (!wasSearchPageDetected)
        return { isMatch: false, searchedText: undefined };
    const searchedText = searchParams.get(searchParamName) ?? "";
    if (!searchedText)
        console.warn("Failed to parse the searched text from the search query", { url, ...loggingContext });
    return { isMatch: true, searchedText };
}
const parseGoogleSearchUrl = (url, loggingContext) => parseUrlByStartAndSearchParam("https://www.google.com/search?q=", "q", url, loggingContext);
const parseYoutubeSearchUrl = (url, loggingContext) => parseUrlByStartAndSearchParam("https://www.youtube.com/results?search_query=", "search_query", url, loggingContext);
const parseAliExpressSearchUrl = (url, loggingContext) => parseUrlByStartAndSearchParam("https://www.aliexpress.com", "SearchText", url, loggingContext);
const parseAmazonSearchUrl = (url, loggingContext) => parseUrlByStartAndSearchParam("https://www.amazon.com/s?", "k", url, loggingContext);
const urlParsers = [parseGoogleSearchUrl, parseYoutubeSearchUrl, parseAliExpressSearchUrl, parseAmazonSearchUrl];
function tryAllUrlParsers(url, loggingContext) {
    for (const urlParser of urlParsers) {
        const { isMatch, searchedText } = urlParser(url, loggingContext);
        if (isMatch)
            return { isMatch, searchedText };
    }
    return { isMatch: false, searchedText: undefined };
}
async function groupClickedSearchResultTabs(tab) {
    console.log("New tab opened", { tab });
    if (!tab.id || tab.id === chrome.tabs.TAB_ID_NONE) {
        console.warn("Triggered for an invalid tab id, weird!", { tabId: tab.id });
        return;
    }
    // Exclude new-tab tabs
    if (tab.pendingUrl === "chrome://newtab/")
        return;
    const openerTabId = tab.openerTabId;
    if (!openerTabId)
        return;
    const openerTab = await chrome.tabs.get(openerTabId);
    if (!openerTab.url)
        return;
    const { isMatch, searchedText } = tryAllUrlParsers(openerTab.url, { openerTab });
    if (!isMatch)
        return;
    const openerInTabGroupAlready = openerTab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE;
    if (openerInTabGroupAlready) {
        await chrome.tabs.group({ groupId: openerTab.groupId, tabIds: [tab.id] });
    }
    else {
        await addTabsToNewGroup([tab.id, openerTabId], searchedText);
    }
}
chrome.tabs.onCreated.addListener(groupClickedSearchResultTabs);
async function addTabsToNewGroup(tabIds, newTabGroupName) {
    const newTabGroupId = await chrome.tabs.group({ tabIds });
    if (newTabGroupName)
        chrome.tabGroups.update(newTabGroupId, { title: newTabGroupName });
}
////////////////////////////////
async function createNewGroup() {
    const newTab = await chrome.tabs.create({});
    if (!newTab.id || newTab.id === chrome.tabs.TAB_ID_NONE) {
        console.warn("The ID of the newly created tab is invalid, weird!", { tabId: newTab.id });
        return;
    }
    await chrome.tabs.group({ tabIds: [newTab.id] });
}
////////////////////////////////
async function closeCurrentGroup() {
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!currentTab)
        return;
    if (!currentTab.groupId || currentTab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE)
        return;
    const tabsInTheSameGroup = await chrome.tabs.query({ groupId: currentTab.groupId });
    const idsOfTabsToRemove = tabsInTheSameGroup
        .map((tab) => tab.id)
        .filter((id) => id !== undefined && id !== chrome.tabs.TAB_ID_NONE);
    await chrome.tabs.remove(idsOfTabsToRemove);
}
////////////////////////////////
async function addCurrentTabToNewGroup() {
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!currentTab || !currentTab.id)
        return;
    if (currentTab.groupId && currentTab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE)
        return;
    await addTabsToNewGroup([currentTab.id], currentTab.title);
}
////////////////////////////////
async function addNewTabToCurrentGroup() {
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!currentTab || !currentTab.id)
        return;
    if (!currentTab.groupId || currentTab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE)
        return;
    const newTab = await chrome.tabs.create({});
    if (!newTab.id || newTab.id === chrome.tabs.TAB_ID_NONE) {
        console.warn("The ID of the newly created tab is invalid, weird!", { tabId: newTab.id, theNewTab: newTab });
        return;
    }
    chrome.tabs.group({ groupId: currentTab.groupId, tabIds: [newTab.id] });
}
////////////////////////////////
chrome.commands.onCommand.addListener(async (command) => {
    console.log("Received command", { command });
    if (command === "create-tabGroup")
        await createNewGroup();
    else if (command === "close-current-tabGroup")
        await closeCurrentGroup();
    else if (command === "add-current-tab-to-new-group")
        await addCurrentTabToNewGroup();
    else if (command === "new-tab-to-current-group")
        await addNewTabToCurrentGroup();
    else
        console.error("An unknown command was received", { command });
});
