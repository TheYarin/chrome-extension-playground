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
const urlParsers = [parseGoogleSearchUrl, parseYoutubeSearchUrl];
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
        const newTabGroupId = await chrome.tabs.group({ tabIds: [tab.id, openerTabId] });
        const newTabGroupName = searchedText;
        chrome.tabGroups.update(newTabGroupId, { title: newTabGroupName });
    }
}
chrome.tabs.onCreated.addListener(groupClickedSearchResultTabs);
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
    if (command === "create-tabGroup")
        await createNewGroup();
    else
        console.error("An unknown command was received", { command });
});
