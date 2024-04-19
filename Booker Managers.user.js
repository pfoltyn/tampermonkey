// ==UserScript==
// @name         Booker Managers
// @namespace    https://github.com/pfoltyn/tampermonkey
// @version      1.1
// @description  Add managers button
// @author       Piotr Foltyn
// @run-at       document-start
// @match        http*://booker.eventmapsolutions.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=codepen.io
// @grant        GM_setClipboard
// @grant        unsafeWindow
// ==/UserScript==

unsafeWindow.pzf_mod = (function() {
    'use strict';

    const error_msg = "Booker API returned an error. Please reload the page and try again.";
    const api_url = "https://booker.eventmapsolutions.com/api/";
    const timer_interval = 1000;
    const refresh_interval = 5 * 60;

    var obj = {};

    var timer_id = null;
    var managers = new Map();
    var terms = new Array();
    var rooms = new Map();
    var requests = new Map();
    var refresh_cnt = 0;

    obj.httpGetAsync = function(theUrl, callback) {
        if (requests.has(theUrl)) {
            requests[theUrl].abort();
        }
        var xmlHttp = new XMLHttpRequest();
        requests[theUrl] = xmlHttp;
        xmlHttp.onreadystatechange = function() {
            if (xmlHttp.readyState === XMLHttpRequest.DONE) {
                const status = xmlHttp.status;
                const error = !(status === 0 || (status >= 200 && status < 400));
                callback(xmlHttp.responseText, error);
            }
            requests.delete(theUrl);
        }
        xmlHttp.open("GET", theUrl, true); // true for asynchronous
        xmlHttp.send(null);
    }

    function parseManagers(msg, error) {
        if (error) {
            return;
        }

        var update = new Map();
        const arr = JSON.parse(msg);
        for (let e of arr) {
            var email = `${e.Id}`
            if (e.Id != null && /^\w{1,6}\d{1,6}$/.test(e.Id.trim())) {
                email = `${e.Id.trim()}@cam.ac.uk`
            }
            update.set(e.OptimeIndex, [e.Forename, e.Surname, email]);
        }
        if (update.size > 0) {
            managers = update;
        }
    }

    function parseTerms(msg, error) {
        if (error) {
            return;
        }

        var term_name = "";
        var update = new Array();
        const now = Date.now();
        const arr = JSON.parse(msg);
        for (let e of arr) {
            const end = new Date(e.EndDate);
            if (end < now) {
                continue;
            }
            const start = new Date(e.StartDate);
            if (start > now) {
                continue;
            }
            term_name = e.Id;
            update = e.DepartmentsAllowingBookings;
            break;
        }
        if (update.length > 0) {
            terms = update;
        }
    }

    function parseRooms(msg, error) {
        if (error) {
            return;
        }

        var update = new Map();
        const arr = JSON.parse(msg);
        for (let e in arr) {
            if (arr[e].OptimeIndex != undefined && arr[e].RoomType != undefined) {
                update.set(arr[e].OptimeIndex, arr[e].RoomType);
            }
        }

        if (update.size > 0) {
            rooms = update;
        }
    }

    function showMessage(msg, error) {
        if (error) {
            alert(error_msg);
            return;
        }

        var display = "";
        const arr = JSON.parse(msg);
        for (let e of arr) {
            const man = managers.get(e)
            if (man != undefined) {
                display += `${man[0]} ${man[1]}: ${man[2]}\n`;
            }
        }
        if (arr.length == 0) {
            display = "No managers selected for that department.";
        } else if (display.trim().length == 0) {
            display = error_msg;
        } else {
            GM.setClipboard(display);
        }
        alert(display);
    }

    function insertEmailAllManagersButton(order) {
        var div = document.getElementById("bookerDepartmentTable_filter");
        if (div && div.childElementCount == order) {
            var node = document.createElement("button");
            node.classList.add("crudActionButton");
            node.title = "Copy All DMs' Emails";
            node.addEventListener("click", function(e) {
                var emails = "";
                var cnt = 0;
                for (let value of managers.values()) {
                    if (value[2].includes("@") && value[2].includes(".")) {
                        emails += `${value[2]};`;
                        cnt++;
                    }
                }
                var message = `${cnt} email addresses copied to clipboard.`;
                if (emails.length == 0) {
                    message = error_msg;
                } else {
                    GM.setClipboard(emails.slice(0, -1));
                }
                alert(message);
            }, false);

            var span = document.createElement("span");
            span.classList.add("hidden-xs");
            span.textContent = "Copy All DMs' Emails";
            node.appendChild(span);

            var i = document.createElement("i");
            i.classList.add("osci", "osci-email");
            node.appendChild(i);

            div.appendChild(node);
        }
    }

    function insertManagersButtons() {
        var table = document.getElementById("bookerDepartmentTable");
        if (table) {
            for (let row of table.rows) {
                var cell = row.cells[row.cells.length - 1];
                if (cell.childElementCount == 2) {
                    var node = document.createElement("i");
                    node.classList.add("osci", "osci-email", "crudEmailIcon");
                    node.title = "Show Managers";
                    node.addEventListener("click", function(e) {
                        const data_id = e.target.getAttribute("data-id");
                        obj.httpGetAsync(`${api_url}booker/departmentOwnership/department/${data_id}`, showMessage);
                    }, false);
                    node.setAttribute("data-id", cell.children[0].getAttribute("data-id"));
                    cell.insertBefore(node, cell.children[0]);
                }
            }
        }
    }

    function insertFilterButton(order, title, txt, id, table) {
        var div = document.getElementById(`booker${table}Table_filter`);
        if (div && div.childElementCount == order) {
            var node = document.createElement("input");
            node.style.cssText = "width:1em !important; height:1em !important";
            node.type = "checkbox";
            node.checked = true;
            node.id = id;

            var span = document.createElement("span");
            span.classList.add("hidden-xs");
            span.textContent = txt;

            var button = document.createElement("button");
            button.title = title;
            button.classList.add("crudActionButton");
            button.addEventListener("click", function(e) {
                var elem = document.getElementById(id);
                if (e.target != elem) {
                    elem.checked = !elem.checked;
                }

                elem = document.getElementsByName(`booker${table}Table_length`);
                if (elem && elem.length > 0) {
                    var ev = new Event("change");
                    elem[0].dispatchEvent(ev);
                }
            }, false);


            button.appendChild(span);
            button.appendChild(node);
            div.appendChild(button);
        }
    }

    function refreshData() {
        refresh_cnt++;

        const update_all = refresh_cnt >= refresh_interval;
        const update_managers = managers.size == 0 || update_all;
        const update_terms = terms.length == 0 || update_all;
        const update_rooms = rooms.size == 0 || update_all;
        
        if (update_all) {
            refresh_cnt = 0;
        }
        if (update_managers) {
            obj.httpGetAsync(`${api_url}staff/getDepartmentManagers`, parseManagers);
        } 
        if (update_terms) {
            obj.httpGetAsync(`${api_url}terms`, parseTerms);
        }
        if (update_rooms) {
            obj.httpGetAsync(`${api_url}rooms/getRoomSelect`, parseRooms);
        }
    }

    function timerCallback() {
        // Room tab
        insertFilterButton(3, "Filter by Hybrid", "Hybrid?", "PZF_HybridFilter", "Room");

        // Department tab
        insertFilterButton(2, "Filter by Live", "Live?", "PZF_LiveFilter", "Department");
        insertFilterButton(3, "Filter by Current Term Bookable", "Current Term Bookable?", "PZF_TermFilter", "Department");
        insertEmailAllManagersButton(4);
        insertManagersButtons();
        refreshData();
    }

    window.addEventListener('hashchange', function (e) {
        if ((window.location.hash != "#crud/departments") &&
            (window.location.hash != "#crud/rooms")) {
            if (timer_id != null) {
                clearInterval(timer_id);
                timer_id = null;
            }
            return;
        }
        if (timer_id == null) {
            timer_id = setInterval(timerCallback, timer_interval);
        }
    });

    if ((window.location.hash == "#crud/departments") ||
        (window.location.hash == "#crud/rooms")) {
        refreshData();

        if (timer_id == null) {
            timer_id = setInterval(timerCallback, timer_interval);
        }
    }

    obj.filterDepartmentData = function(data) {
        var elem = document.getElementById("PZF_LiveFilter");
        if (elem && !elem.checked) {
            var idx = data.data.length;
            while (idx--) {
                if (data.data[idx].Live == true) {
                    data.data.splice(idx, 1);
                }
            }
        }
        elem = document.getElementById("PZF_TermFilter");
        if (elem && !elem.checked) {
            var idx = data.data.length;
            while (idx--) {
                if (terms.includes(data.data[idx].OptimeIndex)) {
                    data.data.splice(idx, 1);
                }
            }
        }

        const total_len = data.data.length;
        if (obj.data_start > 0 && data.data.length > obj.data_start) {
            data.data.splice(0, obj.data_start);
        }
        if (obj.data_len > 0 && data.data.length > obj.data_len) {
            data.data.splice(obj.data_len);
        }
        data.recordsFiltered = total_len;
    }

    obj.filterRoomData = function(data) {
        var elem = document.getElementById("PZF_HybridFilter");
        if (elem && !elem.checked) {
            var idx = data.data.length;
            while (idx--) {
                var room = rooms.get(data.data[idx].OptimeIndex);
                if (room != undefined && !room.includes("Hybrid")) {
                    data.data.splice(idx, 1);
                }
            }
        }

        const total_len = data.data.length;
        if (obj.data_start > 0 && data.data.length > obj.data_start) {
            data.data.splice(0, obj.data_start);
        }
        if (obj.data_len > 0 && data.data.length > obj.data_len) {
            data.data.splice(obj.data_len);
        }
        data.recordsFiltered = total_len;
    }

    obj.addScript = function(text, error) {
        if (error) {
            alert(error_msg);
            return;
        }

        const dep_data_re = /(bookerDepartmentTable\.DataTable.{1,128}data:function\((\w)\)\{)/g;
        const replace_dep_data_re = "$1window.pzf_mod.data_len=$2.length;window.pzf_mod.data_start=$2.start;";
        text = text.replace(dep_data_re, replace_dep_data_re);

        const dep_find_re = /\w\.length(.{1,32}bookerDepartmentTable_filter.{1,128})\w\.start(.{1,16}dataSrc:function\((\w)\)\{)/g;
        const replace_dep_find_re = "999$10$2 window.pzf_mod.filterDepartmentData($3);";
        text = text.replace(dep_find_re, replace_dep_find_re);

        const room_data_re = /(bookerRoomTable\.DataTable.{1,128}data:function\((\w)\)\{)/g;
        const replace_room_data_re = "$1window.pzf_mod.data_len=$2.length;window.pzf_mod.data_start=$2.start;";
        text = text.replace(room_data_re, replace_room_data_re);

        const room_find_re = /\w\.length(.{1,32}bookerRoomTable_filter.{1,128})\w\.start(.{1,16}dataSrc:function\((\w)\)\{)/g;
        const replace_room_find_re = "9999$10$2 window.pzf_mod.filterRoomData($3);";
        text = text.replace(room_find_re, replace_room_find_re);

        var newScript = document.createElement('script');
        newScript.type = "text/javascript";
        newScript.textContent = text;
        var head = document.getElementsByTagName('head')[0];
        head.appendChild(newScript);
    }

    const observer = new MutationObserver(mutations => {
        mutations.forEach(({ addedNodes }) => {
            addedNodes.forEach(node => {
                // For each added script tag
                if (node.nodeType === 1 && node.tagName === "SCRIPT") {
                    const src = node.src || "";
                    const type = node.type;
                    // If the src is inside your blacklist
                    if (src.search(/dist\/booker.+\.js/) != -1) {
                        node.removeAttribute("src");
                        node.type = "text/javascript";
                        node.textContent = `window.pzf_mod.httpGetAsync("${src}", window.pzf_mod.addScript);`;
                    }
                }
            })
        })
    });

    // Starts the monitoring
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    return obj;
})();
