(function ($) {
  $.fn.toggleSwitch = function () {
    return this.each(function () {
      const $toggleSwitch = $(this);
      const $slider = $toggleSwitch.find(".slider");
      const $modeIcon = $toggleSwitch.find(".mode-icon");
      const $sunIcon = $toggleSwitch.find(".sun-icon");
      const $moonIcon = $toggleSwitch.find(".moon-icon");

      const updateUI = () => {
        const isChecked = $toggleSwitch
          .find('input[type="checkbox"]')
          .prop("checked");
        const backgroundColor = isChecked ? "#898873" : "#ffffff";
        const bodyColor = isChecked ? "#ffffff" : "#050505";
        const fileInputColor = isChecked ? "#000000" : "#ffffff";
        const iconPosition = isChecked ? "26px" : "0";

        $slider.css("background-color", backgroundColor);
        $("body").css("background-color", bodyColor);
        $("#fileInputLeft, #fileInputRight").css("color", fileInputColor);
        $modeIcon.css("transform", `translateX(${iconPosition})`);
        $sunIcon.toggleClass("visible", isChecked);
        $moonIcon.toggleClass("visible", !isChecked);
      };

      updateUI();

      $toggleSwitch.find('input[type="checkbox"]').on("change", updateUI);
      $toggleSwitch
        .find('input[type="checkbox"]')
        .on("keydown", function (event) {
          if (event.key === "Enter") {
            $toggleSwitch.find('input[type="checkbox"]').trigger("change");
          }
        });
    });
  };
})(jQuery);

$(".toggle-switch").toggleSwitch();

const appState = {
  left: null,
  right: null,
  differences: [],
  currentDiffIndex: -1,
};

document.addEventListener("DOMContentLoaded", () => {
  class Editor {
    constructor(side) {
      this.side = side;
      this.fileInput = document.getElementById(`fileInput${side}`);
      this.tabs = document.querySelector(`#fileInput${side} + .tabs`);
      this.raw = document.getElementById(`raw${side}`);
      this.tree = document.getElementById(`tree${side}`);
      this.table = document.getElementById(`table${side}`);
      this.formatButtons = document.querySelectorAll(
        `#fileInput${side} ~ .button-container .format-button`
      );
      this.treeButtons = document.querySelectorAll(
        `#fileInput${side} ~ .button-container .tree-button`
      );

      this.initEventListeners();
    }

    initEventListeners() {
      this.fileInput.addEventListener("change", (e) => this.handleFile(e));
      this.tabs.addEventListener("click", (e) => this.handleTab(e));
      this.raw.addEventListener("input", (e) => this.handleRawInput(e));
      this.formatButtons.forEach((button) => {
        button.addEventListener("click", (e) => this.handleFormat(e));
      });
      this.treeButtons.forEach((button) => {
        button.addEventListener("click", (e) => this.handleTree(e));
      });
      this.tree.addEventListener("toggle", (e) => this.handleDetailsToggle(e));
    }

    handleFile(e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          appState[this.side.toLowerCase()] = JSON.parse(event.target.result);
          this.updateView();
        } catch (error) {
          this.raw.innerText = "Invalid JSON file";
          this.tree.innerHTML = "";
          this.table.innerHTML = "";
        }
      };
      reader.readAsText(file);
    }

    handleTab(e) {
      if (!e.target.classList.contains("tab")) return;

      this.tabs
        .querySelectorAll(".tab")
        .forEach((t) => t.classList.remove("active"));
      e.target.classList.add("active");

      this.raw.style.display = "none";
      this.tree.style.display = "none";
      this.table.style.display = "none";

      const targetId = e.target.dataset.target;
      document.getElementById(targetId).style.display = "block";

      this.updateButtons();
      this.updateView();
    }

    handleRawInput(e) {
      try {
        appState[this.side.toLowerCase()] = JSON.parse(e.target.innerText);
        this.updateView();
      } catch (error) {
        // Invalid JSON, do nothing
      }
    }

    handleFormat(e) {
      const format = e.currentTarget.dataset.format;
      this.updateView(format);
    }

    handleTree(e) {
      const action = e.currentTarget.id.replace(this.side, "").toLowerCase();
      const details = this.tree.querySelectorAll("details");
      if (action === "expandall") {
        details.forEach((detail) => detail.setAttribute("open", ""));
      } else {
        details.forEach((detail) => detail.removeAttribute("open"));
      }
      this.updateDetailsHighlight();
    }

    handleDetailsToggle(e) {
      if (e.target.tagName !== "DETAILS") return;
      this.updateDetailsHighlight();
    }

    updateDetailsHighlight() {
      const details = this.tree.querySelectorAll("details");
      details.forEach((detail) => {
        const summary = detail.querySelector("summary");
        const spans = detail.querySelectorAll("span[data-path]");
        const hasDiffChild = Array.from(spans).some((span) =>
          appState.differences.includes(span.getAttribute("data-path"))
        );
        if (!detail.hasAttribute("open") && hasDiffChild) {
          summary.classList.add("highlight");
        } else {
          summary.classList.remove("highlight");
        }
      });
    }

    updateView(format = "indented") {
      const jsonData = appState[this.side.toLowerCase()];
      if (!jsonData) return;

      let formattedJson;
      switch (format) {
        case "indented":
          formattedJson = JSON.stringify(jsonData, null, 2);
          break;
        case "smart":
          formattedJson = JSON.stringify(jsonData, null, 1);
          break;
        case "compact":
          formattedJson = JSON.stringify(jsonData);
          break;
      }

      this.raw.innerText = formattedJson;
      this.tree.innerHTML = this.generateTree(jsonData);
      this.table.innerHTML = this.generateTable(jsonData);
      this.updateDetailsHighlight();
    }

    updateButtons() {
      const activeTab = this.tabs.querySelector(".tab.active").dataset.target;
      const isRaw = activeTab.startsWith("raw");
      const isTree = activeTab.startsWith("tree");

      this.formatButtons.forEach((btn) =>
        btn.classList.toggle("hidden", !isRaw)
      );
      this.treeButtons.forEach((btn) =>
        btn.classList.toggle("hidden", !isTree)
      );
    }

    getOpenDetailsPaths() {
      const openDetails = this.tree.querySelectorAll("details[open]");
      const paths = new Set();
      openDetails.forEach((detail) => {
        const path = detail.getAttribute("data-path");
        if (path) paths.add(path);
      });
      return paths;
    }

    restoreDetailsState(openPaths) {
      openPaths.forEach((path) => {
        const detail = this.tree.querySelector(`details[data-path="${path}"]`);
        if (detail) detail.setAttribute("open", "");
      });
    }

    generateTree(
      obj,
      path = "",
      differences = new Set(),
      currentDiffPath = ""
    ) {
      const value = (val) => {
        if (typeof val === "string")
          return `<span class="string">"${val}"</span>`;
        if (typeof val === "number")
          return `<span class="number">${val}</span>`;
        if (typeof val === "boolean")
          return `<span class="boolean">${val}</span>`;
        if (val === null) return `<span class="null">null</span>`;
        return val;
      };

      const hasChildDifferences = (obj, currentPath) => {
        if (!obj || typeof obj !== "object") return false;
        return appState.differences.some(
          (diffPath) =>
            diffPath.startsWith(currentPath + ".") && diffPath !== currentPath
        );
      };

      const tree = (obj, indent = 0, path = "") => {
        const padding = " ".repeat(indent * 2);

        if (Array.isArray(obj)) {
          const hasDiff = hasChildDifferences(obj, path);
          let html = `${padding}<details data-path="${path}"><summary class="${
            hasDiff ? "highlight" : ""
          }" style="display: flex margin-left: 20px;"><span class="key"> : </span>[${obj.length} items]</summary>`;
          obj.forEach((item, index) => {
            const itemPath = path ? `${path}.${index}` : `${index}`;
            const isHighlighted = differences.has(itemPath);
            const isCurrent = itemPath === currentDiffPath;
            html += `${padding}  <div style="display: flex"><span class="key${
              isHighlighted ? " highlight" : ""
            }${
              isCurrent ? " current-highlight" : ""
            }" data-path="${itemPath}" style="display: flex">${index} : </span>`;
            if (typeof item === "object" && item !== null) {
              html += `${tree(item, indent + 1, itemPath)}</div>`;
            } else {
              html += `<span class="${isHighlighted ? "highlight" : ""}${
                isCurrent ? " current-highlight" : ""
              }" data-path="${itemPath}">${value(item)}</span></div>`;
            }
          });
          html += `${padding}</details>`;
          return html;
        }
        if (obj && typeof obj === "object") {
          const hasDiff = hasChildDifferences(obj, path);
          let html = `${padding}<details data-path="${path}"><summary class="${
            hasDiff ? "highlight" : ""
          }" style="display: flex margin-left: 20px;"><span class="key"> : </span>{${
            Object.keys(obj).length
          } keys}</summary>`;
          for (const key in obj) {
            const keyPath = path ? `${path}.${key}` : key;
            const isHighlighted = differences.has(keyPath);
            const isCurrent = keyPath === currentDiffPath;
            html += `${padding}  <div style="display: flex"><span class="key${
              isHighlighted ? " highlight" : ""
            }${
              isCurrent ? " current-highlight" : ""
            }" data-path="${keyPath}" style="display: flex">${key} : </span>`;
            if (typeof obj[key] === "object" && obj[key] !== null) {
              html += `${tree(obj[key], indent + 1, keyPath)}</div>`;
            } else {
              html += `<span class="${isHighlighted ? "highlight" : ""}${
                isCurrent ? " current-highlight" : ""
              }" data-path="${keyPath}">${value(obj[key])}</span></div>`;
            }
          }
          html += `${padding}</details>`;
          return html;
        }
       
        const isHighlighted = differences.has(path);
        const isCurrent = path === currentDiffPath;
        return `<span class="${isHighlighted ? "highlight" : ""}${
          isCurrent ? " current-highlight" : ""
        }" data-path="${path}">${value(obj)}</span>`;
      };
      return tree(obj, 0, path);
}

    generateTable(obj) {
      if (!Array.isArray(obj) || obj.length === 0) return "";

      const allKeys = Array.from(
        obj.reduce((keys, item) => {
          if (item && typeof item === "object" && !Array.isArray(item)) {
            Object.keys(item).forEach((key) => keys.add(key));
          }
          return keys;
        }, new Set())
      );

      let html = "<table><thead><tr>";
      allKeys.forEach((key) => (html += `<th>${key}</th>`));
      html += "</tr></thead><tbody>";

      obj.forEach((item) => {
        html += "<tr>";
        allKeys.forEach((key) => {
          const value = item[key];
          const typeClass =
            typeof value === "string"
              ? "string"
              : typeof value === "number"
              ? "number"
              : typeof value === "boolean"
              ? "boolean"
              : value === null
              ? "null"
              : "";
          const displayValue =
            value !== undefined
              ? typeClass === "string"
                ? `"${value}"`
                : value
              : "";
          html += `<td><span class="${typeClass}">${displayValue}</span></td>`;
        });
        html += "</tr>";
      });

      html += "</tbody></table>";
      return html;
    }

    highlightTreeDifferences(differences, currentDiffPath = "") {
      const openPaths = this.getOpenDetailsPaths();
      this.tree.innerHTML = this.generateTree(
        appState[this.side.toLowerCase()],
        "",
        differences,
        currentDiffPath
      );
      this.restoreDetailsState(openPaths);
      this.updateDetailsHighlight();
      if (currentDiffPath) {
        const parts = currentDiffPath.split(".");
        let path = "";
        parts.forEach((part, index) => {
          path += (index > 0 ? "." : "") + part;
          const element = this.tree.querySelector(`[data-path="${path}"]`);
          if (element) {
            let parent = element.closest("details");
            while (parent) {
              parent.setAttribute("open", "");
              parent = parent.parentElement.closest("details");
            }
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        });
      }
    }
  }

  const leftEditor = new Editor("Left");
  const rightEditor = new Editor("Right");

  function findJsonDifferences(
    left,
    right,
    path = "",
    differences = new Set()
  ) {
    if (left === right) return differences;

    if (Array.isArray(left) && Array.isArray(right)) {
      const maxLength = Math.max(left.length, right.length);
      let hasDifference = false;
      for (let i = 0; i < maxLength; i++) {
        const leftItem = left[i];
        const rightItem = right[i];
        const itemPath = path ? `${path}.${i}` : `${i}`;
        if (leftItem === undefined || rightItem === undefined) {
          differences.add(itemPath);
          hasDifference = true;
        } else if (JSON.stringify(leftItem) !== JSON.stringify(rightItem)) {
          findJsonDifferences(leftItem, rightItem, itemPath, differences);
          hasDifference = true;
        }
      }
      if (!hasDifference && JSON.stringify(left) !== JSON.stringify(right)) {
        differences.add(path);
      }
    } else if (
      left &&
      typeof left === "object" &&
      right &&
      typeof right === "object"
    ) {
      const allKeys = new Set([...Object.keys(left), ...Object.keys(right)]);
      let hasDifference = false;
      for (const key of allKeys) {
        const leftValue = left[key];
        const rightValue = right[key];
        const keyPath = path ? `${path}.${key}` : key;
        if (leftValue === undefined || rightValue === undefined) {
          differences.add(keyPath);
          hasDifference = true;
        } else if (JSON.stringify(leftValue) !== JSON.stringify(rightValue)) {
          findJsonDifferences(leftValue, rightValue, keyPath, differences);
          hasDifference = true;
        }
      }
      if (!hasDifference && JSON.stringify(left) !== JSON.stringify(right)) {
        differences.add(path);
      }
    } else {
      differences.add(path);
    }
    return differences;
  }

  function navigateDifferences(direction) {
    if (appState.differences.length === 0) return;

    if (direction === "next") {
      appState.currentDiffIndex =
        (appState.currentDiffIndex + 1) % appState.differences.length;
    } else if (direction === "prev") {
      appState.currentDiffIndex =
        (appState.currentDiffIndex - 1 + appState.differences.length) %
        appState.differences.length;
    }

    const currentDiffPath = appState.differences[appState.currentDiffIndex];
    leftEditor.highlightTreeDifferences(
      new Set(appState.differences),
      currentDiffPath
    );
    rightEditor.highlightTreeDifferences(
      new Set(appState.differences),
      currentDiffPath
    );
  }

  document.getElementById("compareButton").addEventListener("click", () => {
    const leftTab = leftEditor.tabs.querySelector(".tab.active").dataset.target;
    const rightTab =
      rightEditor.tabs.querySelector(".tab.active").dataset.target;

    if (leftTab !== "treeLeft" || rightTab !== "treeRight") {
      alert("Please select the Tree tab in both editors to compare.");
      return;
    }

    if (!appState.left || !appState.right) {
      alert("Please load JSON data in both panels to compare.");
      return;
    }

    const differencesSet = findJsonDifferences(appState.left, appState.right);
    appState.differences = Array.from(differencesSet);
    appState.currentDiffIndex = appState.differences.length > 0 ? 0 : -1;

    const currentDiffPath =
      appState.differences.length > 0 ? appState.differences[0] : "";
    leftEditor.highlightTreeDifferences(differencesSet, currentDiffPath);
    rightEditor.highlightTreeDifferences(differencesSet, currentDiffPath);
  });

  document.getElementById("prevDiff").addEventListener("click", () => {
    navigateDifferences("prev");
  });

  document.getElementById("nextDiff").addEventListener("click", () => {
    navigateDifferences("next");
  });
});
