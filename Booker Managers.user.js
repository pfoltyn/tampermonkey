// ==UserScript==
// @name         Booker Managers
// @namespace    https://github.com/pfoltyn/tampermonkey
// @version      0.4
// @description  Add managers button
// @author       Piotr Foltyn
// @match        http*://booker.eventmapsolutions.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=codepen.io
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    const api_url = "https://booker.eventmapsolutions.com/api/";
    var timer_id = null;
    var managers = null;
    var refresh_cnt = 0;

    function httpGetAsync(theUrl, callback) {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = function() {
            if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
                callback(xmlHttp.responseText);
            }
        }
        xmlHttp.open("GET", theUrl, true); // true for asynchronous
        xmlHttp.send(null);
    }

    function parseManagers(msg) {
        managers = new Map();
        const arr = JSON.parse(msg);
        arr.forEach(function(e) {
            if (e.Id != null && /^\w{2,5}\d{2,6}$/.test(e.Id.trim())) {
                managers.set(e.OptimeIndex, [e.Forename, e.Surname, `${e.Id.trim()}@cam.ac.uk`]);
            }
        });
    }

    function showMessage(msg) {
        var display = "";
        const arr = JSON.parse(msg);
        arr.forEach(function(e) {
            const man = managers.get(e)
            if (man != undefined) {
                display += `${man[0]} ${man[1]} ${man[2]}\n`;
            }
        });
        if (arr.length == 0) {
            display = "No managers selected for that department.";
        }
        GM.setClipboard(display);
        alert(display);
    }

    function insertEmailAllManagersButton() {
        var div = document.getElementById("bookerDepartmentTable_filter");
        if (div.children.length == 2) {
            var node = document.createElement("button");
            node.classList.add("crudActionButton");
            node.title = "Copy All DMs' Emails";
            node.style.color = "white";
            node.addEventListener("click", function(e) {
                var emails = "";
                for (let value of managers.values()) {
                    emails += `${value[2]};`;
                }
                GM.setClipboard(emails.slice(0, -1));
                alert("Emails copied to clipboard.");
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
        for (var i = 0, row; row = table.rows[i]; i++) {
            var cell = row.cells[row.cells.length - 1];
            if (cell.childElementCount == 2) {
                var node = document.createElement("i");
                node.classList.add("osci", "osci-email", "crudEmailIcon");
                node.title = "Show Managers";
                node.addEventListener("click", function(e) {
                    const data_id = e.target.getAttribute("data-id");
                    httpGetAsync(`${api_url}booker/departmentOwnership/department/${data_id}`, showMessage);
                }, false);
                node.setAttribute("data-id", cell.children[0].getAttribute("data-id"));
                cell.insertBefore(node, cell.children[0]);
            }
        }
    }

    function refreshManagers() {
        refresh_cnt++;
        if (refresh_cnt >= 60) {
            refresh_cnt = 0;
            httpGetAsync(`${api_url}staff/getDepartmentManagers`, parseManagers);
        }
    }

    function timerCallback() {
        insertEmailAllManagersButton();
        insertManagersButtons();
        refreshManagers();
    }

    window.addEventListener('hashchange', function (e) {
        if (window.location.hash != "#crud/departments") {
            if (timer_id != null) {
                clearInterval(timer_id);
                timer_id = null;
            }
            return;
        }
        if (timer_id == null) {
            timer_id = setInterval(timerCallback, 1000);
        }
    });

    if (window.location.hash == "#crud/departments") {
        httpGetAsync(`${api_url}staff/getDepartmentManagers`, parseManagers);

        if (timer_id == null) {
            timer_id = setInterval(timerCallback, 1000);
        }
    }
})();