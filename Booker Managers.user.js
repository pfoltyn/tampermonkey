// ==UserScript==
// @name         Booker Managers
// @namespace    https://github.com/pfoltyn/tampermonkey
// @version      0.3
// @description  Add managers button
// @author       Piotr Foltyn
// @match        http*://booker.eventmapsolutions.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=codepen.io
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';
    var timer_id = null;
    var managers = null;
	var refresh_cnt = 0

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
            managers.set(e.OptimeIndex, `${e.Forename} ${e.Surname} ${e.Id}@cam.ac.uk`);
        });
    }

    function showMessage(msg) {
        var display = "";
        const arr = JSON.parse(msg);
        arr.forEach(function(e) {
            display += managers.get(e) + "\n";
        });
        if (arr.length == 0) {
            display = "No managers selected for that department.";
        }
        GM.setClipboard(display);
        alert(display);
    }

    function insertManagersButton () {
        var table = document.getElementById("bookerDepartmentTable");
        for (var i = 0, row; row = table.rows[i]; i++) {
            var cell = row.cells[row.cells.length - 1];
            if (cell.childElementCount == 2) {
                var node = document.createElement("i");
                node.classList.add("osci", "osci-email", "crudEmailIcon");
                node.title = "Show Managers";
                node.addEventListener("click", function(e) {
                    const data_id = e.target.getAttribute("data-id");
                    httpGetAsync("https://booker.eventmapsolutions.com/api/booker/departmentOwnership/department/" + data_id, showMessage);
                }, false);
                node.setAttribute("data-id", cell.children[0].getAttribute("data-id"));
                cell.insertBefore(node, cell.children[0]);
            }
        }
		refresh_cnt++;
		if (refresh_cnt >= 60) {
			refresh_cnt = 0;
			httpGetAsync("https://booker.eventmapsolutions.com/api/staff/getDepartmentManagers", parseManagers);
		}
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
            timer_id = setInterval(insertManagersButton, 1000);
        }
    });

    if (window.location.hash == "#crud/departments") {
        httpGetAsync("https://booker.eventmapsolutions.com/api/staff/getDepartmentManagers", parseManagers);

        if (timer_id == null) {
            timer_id = setInterval(insertManagersButton, 1000);
        }
    }
})();