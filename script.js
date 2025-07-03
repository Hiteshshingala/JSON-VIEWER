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
        const iconPosition = isChecked ? "26px" : "0";

        $slider.css("background-color", backgroundColor);
        $("body").css("background-color", bodyColor);
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

var gk_isXlsx = false;
var gk_xlsxFileLookup = {};
var gk_fileData = {};
function filledCell(cell) {
  return cell !== "" && cell != null;
}
function loadFileData(filename) {
  if (gk_isXlsx && gk_xlsxFileLookup[filename]) {
    try {
      var workbook = XLSX.read(gk_fileData[filename], { type: "base64" });
      var firstSheetName = workbook.SheetNames[0];
      var worksheet = workbook.Sheets[firstSheetName];
      var jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        blankrows: false,
        defval: "",
      });
      var filteredData = jsonData.filter((row) => row.some(filledCell));
      var headerRowIndex = filteredData.findIndex(
        (row, index) =>
          row.filter(filledCell).length >=
          filteredData[index + 1]?.filter(filledCell).length
      );
      if (headerRowIndex === -1 || headerRowIndex > 25) {
        headerRowIndex = 0;
      }
      var csv = XLSX.utils.aoa_to_sheet(filteredData.slice(headerRowIndex));
      csv = XLSX.utils.sheet_to_csv(csv);
      return csv;
    } catch (e) {
      console.error(e);
      return "";
    }
  }
  return gk_fileData[filename] || "";
}

// Initialize CodeMirror editors
const leftEditor = CodeMirror.fromTextArea(
  document.getElementById("left-editor"),
  {
    mode: "application/json",
    height: "100%",
    theme: "monokai",
    lineNumbers: true,
    lineWrapping: true,
    matchBrackets: true,
    autoCloseBrackets: true,
  }
);

const rightEditor = CodeMirror.fromTextArea(
  document.getElementById("right-editor"),
  {
    mode: "application/json",
    height: "100%",
    theme: "monokai",
    lineNumbers: true,
    lineWrapping: true,
    matchBrackets: true,
    autoCloseBrackets: true,
  }
);

// State to track current view mode and highlights
let leftViewMode = "text";
let rightViewMode = "text";
let leftHighlights = [];
let rightHighlights = [];

// JSON formatting functions
function formatJSON(editor, mode) {
  try {
    const json = JSON.parse(editor.getValue());
    if (mode === "indented") {
      editor.setValue(JSON.stringify(json, null, 2));
    } else if (mode === "smart") {
      const depth = JSON.stringify(json).length > 500 ? 1 : 2;
      editor.setValue(JSON.stringify(json, null, depth));
    } else if (mode === "compact") {
      editor.setValue(JSON.stringify(json));
    }
  } catch (e) {
    alert("Invalid JSON: " + e.message);
  }
}

// Custom JSON Tree View with CodeMirror styling
function renderJSONTree(container, json, side) {
  try {
    const data = JSON.parse(json);
    const tree = document.createElement("div");
    tree.className = "json-tree";
    tree.appendChild(createTreeNode(data, "", true, "", side));
    container.innerHTML = "";
    container.appendChild(tree);
  } catch (e) {
    alert("Invalid JSON for tree view: " + e.message);
    toggleView(container.id.includes("left") ? "left" : "right", "text");
  }
}

function createTreeNode(
  data,
  key = "",
  isRoot = false,
  path = "",
  side = "left"
) {
  const li = document.createElement("li");
  li.id = `node-${path || "root"}`;
  if (typeof data === "object" && data !== null) {
    const isArray = Array.isArray(data);
    const toggle = document.createElement("span");
    toggle.className = "toggle";
    toggle.addEventListener("click", () => {
      toggle.classList.toggle("open");
      ul.style.display = ul.style.display === "none" ? "block" : "none";
    });

    const keySpan = document.createElement("span");
    keySpan.className = `cm-property ${isArray ? "array" : "object"}`;
    keySpan.id = `key-${path || "root"}`;
    keySpan.textContent = key ? `${key}: ` : isArray ? "Array" : "Object";
    li.appendChild(toggle);
    li.appendChild(keySpan);

    // Add action menu for arrays and objects
    if (Array.isArray(data) || (typeof data === "object" && data !== null)) {
      li.appendChild(createActionMenu(path || "root", side));
    }

    const ul = document.createElement("ul");
    ul.style.display = "none";
    if (isRoot) {
      toggle.classList.add("open");
      ul.style.display = "block";
    }

    if (isArray) {
      data.forEach((item, index) => {
        const childPath = path ? `${path}.${index}` : `${index}`;
        const childLi = createTreeNode(
          item,
          `[${index}]`,
          false,
          childPath,
          side
        );
        ul.appendChild(childLi);
      });
    } else {
      Object.entries(data).forEach(([k, v]) => {
        const childPath = path ? `${path}.${k}` : k;
        const childLi = createTreeNode(v, k, false, childPath, side);
        ul.appendChild(childLi);
      });
    }

    li.appendChild(ul);
  } else {
    const keySpan = document.createElement("span");
    keySpan.className = "cm-property";
    keySpan.id = `key-${path || "root"}`;
    keySpan.textContent = key ? `${key}: ` : "";

    const valueSpan = document.createElement("span");
    valueSpan.className =
      typeof data === "string"
        ? "cm-string"
        : typeof data === "number"
        ? "cm-number"
        : typeof data === "boolean"
        ? "cm-boolean"
        : "cm-null";
    valueSpan.id = `value-${path || "root"}`;
    valueSpan.textContent = JSON.stringify(data);

    li.appendChild(keySpan);
    li.appendChild(valueSpan);
  }
  return li;
}

// Render Table View with CodeMirror styling
function renderTable(container, json) {
  try {
    const data = JSON.parse(json);
    if (!Array.isArray(data) && typeof data !== "object") {
      throw new Error("JSON must be an object or array for table view");
    }
    const table = document.createElement("table");
    table.className = "w-full text-[#f8f8f2] border-collapse font-mono text-xs";
    const tbody = document.createElement("tbody");
    if (Array.isArray(data)) {
      const headers = Object.keys(data[0] || {});
      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");
      headers.forEach((key) => {
        const th = document.createElement("th");
        th.className = "border border-[#49483e] p-2 cm-property";
        th.textContent = key;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);
      data.forEach((item) => {
        const tr = document.createElement("tr");
        headers.forEach((key) => {
          const td = document.createElement("td");
          td.className = "border border-[#49483e] p-2";
          const value = item[key];
          td.className +=
            " " +
            (typeof value === "string"
              ? "cm-string"
              : typeof value === "number"
              ? "cm-number"
              : typeof value === "boolean"
              ? "cm-boolean"
              : value === null
              ? "cm-null"
              : "");
          td.textContent = JSON.stringify(value || "");
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    } else {
      Object.entries(data).forEach(([key, value]) => {
        const tr = document.createElement("tr");
        const tdKey = document.createElement("td");
        tdKey.className = "border border-[#49483e] p-2 cm-property";
        tdKey.textContent = key;
        const tdValue = document.createElement("td");
        tdValue.className = "border border-[#49483e] p-2";
        tdValue.className +=
          " " +
          (typeof value === "string"
            ? "cm-string"
            : typeof value === "number"
            ? "cm-number"
            : typeof value === "boolean"
            ? "cm-boolean"
            : value === null
            ? "cm-null"
            : "");
        tdValue.textContent = JSON.stringify(value);
        tr.appendChild(tdKey);
        tr.appendChild(tdValue);
        tbody.appendChild(tr);
      });
    }
    table.appendChild(tbody);
    container.innerHTML = "";
    container.appendChild(table);
  } catch (e) {
    alert("Invalid JSON for table view: " + e.message);
  }
}

function toggleView(side, mode) {
  const container = document.getElementById(`${side}-container`);
  const editor = side === "left" ? leftEditor : rightEditor;
  const buttons = {
    text: document.getElementById(`text-${side}`),
    tree: document.getElementById(`tree-${side}`),
    table: document.getElementById(`table-${side}`),
  };
  const formatButtons = [
    document.getElementById(`indented-${side}`),
    document.getElementById(`smart-${side}`),
    document.getElementById(`compact-${side}`),
  ];
  const treeButtons = [
    document.getElementById(`expandAll-${side}`),
    document.getElementById(`collapseAll-${side}`),
  ];

  Object.values(buttons).forEach((btn) => {
    btn.className = "bg-[#a6e22e] text-[#272822] rounded px-1.5 py-[1px]";
  });
  buttons[mode].className =
    "bg-[#272822] text-[#a6e22e] rounded px-1.5 py-[1px] font-semibold";

  if (mode === "text") {
    formatButtons.forEach((btn) => {
      btn.classList.remove("hidden");
      btn.classList.add("format-button");
    });
    treeButtons.forEach((btn) => {
      btn.classList.add("hidden");
      btn.classList.remove("active");
    });
  } else if (mode === "tree") {
    formatButtons.forEach((btn) => {
      btn.classList.add("hidden");
      btn.classList.remove("format-button");
    });
    treeButtons.forEach((btn) => {
      btn.classList.remove("hidden");
      btn.classList.add("active");
    });
  } else {
    formatButtons.forEach((btn) => {
      btn.classList.add("hidden");
      btn.classList.remove("format-button");
    });
    treeButtons.forEach((btn) => {
      btn.classList.add("hidden");
      btn.classList.remove("active");
    });
  }

  container.innerHTML = "";
  container.style.height = mode === "table" ? "450px" : "828px";
  container.style.width = "100%";
  container.style.overflow = "hidden";

  if (mode === "text") {
    container.appendChild(editor.getWrapperElement());
    editor.getWrapperElement().style.height = "828px";
    editor.getWrapperElement().style.width = "100%";
    editor.refresh();
  } else if (mode === "tree") {
    renderJSONTree(container, editor.getValue(), side);
    const tree = container.querySelector(".json-tree");
    if (tree) {
      tree.style.height = "828px";
      tree.style.width = "100%";
    }
  } else if (mode === "table") {
    renderTable(container, editor.getValue());
    const table = container.querySelector("table");
    if (table) {
      table.style.height = "850px";
      table.style.width = "100%";
      table.style.overflow = "auto";
      table.style.display = "block";
    }
  }
  if (side === "left") leftViewMode = mode;
  else rightViewMode = mode;
  applyHighlights(side);
}

// Expand/Collapse tree functions
function toggleTreeNodes(side, action) {
  const container = document.getElementById(`${side}-container`);
  const toggles = container.querySelectorAll(".json-tree .toggle");
  toggles.forEach((toggle) => {
    const ul = toggle.parentElement.querySelector("ul");
    if (ul) {
      if (action === "expand") {
        toggle.classList.add("open");
        ul.style.display = "block";
      } else if (action === "collapse") {
        toggle.classList.remove("open");
        ul.style.display = "none";
      }
    }
  });
  applyHighlights(side);
}

// File upload handler
function handleFileUpload(input, editor) {
  input.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (file.name.endsWith(".xlsx")) {
          gk_isXlsx = true;
          gk_xlsxFileLookup[file.name] = true;
          gk_fileData[file.name] = event.target.result.split(",")[1];
          editor.setValue(loadFileData(file.name));
        } else {
          editor.setValue(event.target.result);
        }
        toggleView(input.id.includes("left") ? "left" : "right", "text");
      };
      if (file.name.endsWith(".xlsx")) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    }
  });
}

// New button handlers
document.getElementById("new-left").addEventListener("click", () => {
  leftEditor.setValue("");
  clearHighlights("left");
  toggleView("left", "text");
});
document.getElementById("new-right").addEventListener("click", () => {
  rightEditor.setValue("");
  clearHighlights("right");
  toggleView("right", "text");
});

// Open button handlers
document.getElementById("open-left").addEventListener("click", () => {
  document.getElementById("file-left").click();
});
document.getElementById("open-right").addEventListener("click", () => {
  document.getElementById("file-right").click();
});
handleFileUpload(document.getElementById("file-left"), leftEditor);
handleFileUpload(document.getElementById("file-right"), rightEditor);

// Save button handlers
document.getElementById("save-left").addEventListener("click", () => {
  try {
    const blob = new Blob([leftEditor.getValue()], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "left.json";
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert("Error saving JSON: " + e.message);
  }
});
document.getElementById("save-right").addEventListener("click", () => {
  try {
    const blob = new Blob([rightEditor.getValue()], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "right.json";
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert("Error saving JSON: " + e.message);
  }
});

// Copy button handlers
document.getElementById("copy-left-to-right").addEventListener("click", () => {
  rightEditor.setValue(leftEditor.getValue());
  clearHighlights("right");
  toggleView("right", rightViewMode);
});
document.getElementById("copy-right-to-left").addEventListener("click", () => {
  leftEditor.setValue(rightEditor.getValue());
  clearHighlights("left");
  toggleView("left", leftViewMode);
});

// Format button handlers
document.getElementById("indented-left").addEventListener("click", () => {
  formatJSON(leftEditor, "indented");
});
document.getElementById("smart-left").addEventListener("click", () => {
  formatJSON(leftEditor, "smart");
});
document.getElementById("compact-left").addEventListener("click", () => {
  formatJSON(leftEditor, "compact");
});
document.getElementById("indented-right").addEventListener("click", () => {
  formatJSON(rightEditor, "indented");
});
document.getElementById("smart-right").addEventListener("click", () => {
  formatJSON(rightEditor, "smart");
});
document.getElementById("compact-right").addEventListener("click", () => {
  formatJSON(rightEditor, "compact");
});

// View mode button handlers
document.getElementById("text-left").addEventListener("click", () => {
  clearHighlights("left");
  toggleView("left", "text");
  applyHighlights("left");
});
document.getElementById("tree-left").addEventListener("click", () => {
  clearHighlights("left");
  toggleView("left", "tree");
  applyHighlights("left");
});
document.getElementById("table-left").addEventListener("click", () => {
  clearHighlights("left");
  toggleView("left", "table");
});
document.getElementById("text-right").addEventListener("click", () => {
  clearHighlights("right");
  toggleView("right", "text");
  applyHighlights("right");
});
document.getElementById("tree-right").addEventListener("click", () => {
  clearHighlights("right");
  toggleView("right", "tree");
  applyHighlights("right");
});
document.getElementById("table-right").addEventListener("click", () => {
  clearHighlights("right");
  toggleView("right", "table");
});

// Expand/Collapse button handlers
document.getElementById("expandAll-left").addEventListener("click", () => {
  toggleTreeNodes("left", "expand");
});
document.getElementById("collapseAll-left").addEventListener("click", () => {
  toggleTreeNodes("left", "collapse");
});
document.getElementById("expandAll-right").addEventListener("click", () => {
  toggleTreeNodes("right", "expand");
});
document.getElementById("collapseAll-right").addEventListener("click", () => {
  toggleTreeNodes("right", "collapse");
});

// Clear highlights
function clearHighlights(side) {
  const editor = side === "left" ? leftEditor : rightEditor;
  const container = document.getElementById(`${side}-container`);
  if (side === "left") {
    leftHighlights.forEach((h) => h.clear && h.clear());
    leftHighlights = [];
  } else {
    rightHighlights.forEach((h) => h.clear && h.clear());
    rightHighlights = [];
  }
  container
    .querySelectorAll(".highlight-diff, .highlight-parent")
    .forEach((el) => {
      el.classList.remove("highlight-diff", "highlight-parent");
    });
}

// Apply highlights
function applyHighlights(side) {
  const editor = side === "left" ? leftEditor : rightEditor;
  const container = document.getElementById(`${side}-container`);
  const viewMode = side === "left" ? leftViewMode : rightViewMode;
  const highlights = side === "left" ? leftHighlights : rightHighlights;

  if (viewMode === "text") {
    highlights.forEach((h) => {
      if (h.line != null) {
        const lineHandle = editor.addLineClass(
          h.line,
          "background",
          h.isParent ? "highlight-parent" : "highlight-diff"
        );
        highlights[highlights.indexOf(h)] = {
          ...h,
          clear: () =>
            editor.removeLineClass(
              lineHandle,
              "background",
              h.isParent ? "highlight-parent" : "highlight-diff"
            ),
        };
      }
    });
  } else if (viewMode === "tree") {
    highlights.forEach((h) => {
      const keyId = `key-${h.path.replace(/\./g, "\\.")}`;
      const valueId = `value-${h.path.replace(/\./g, "\\.")}`;
      const nodeId = `node-${h.path.replace(/\./g, "\\.")}`;

      const keyElement = container.querySelector(`#${keyId}`);
      const valueElement = container.querySelector(`#${valueId}`);
      const nodeElement = container.querySelector(`#${nodeId}`);

      if (h.isParent) {
        if (keyElement) {
          keyElement.classList.add("highlight-parent");
        }
      } else {
        if (keyElement) {
          keyElement.classList.add("highlight-diff");
        }
        if (valueElement) {
          valueElement.classList.add("highlight-diff");
        }
        if (nodeElement && !valueElement) {
          nodeElement.classList.add("highlight-diff");
        }
      }
    });
    const tree = container.querySelector(".json-tree");
    if (tree) {
      tree.style.height = "828px";
      tree.style.overflow = "auto";
    }
  } else if (viewMode === "table") {
    highlights.forEach((h) => {
      const pathParts = h.path.split(".");
      const rowIndex =
        pathParts.length > 1 ? parseInt(pathParts[pathParts.length - 2]) : -1;
      const key = pathParts[pathParts.length - 1];
      const table = container.querySelector("table");
      if (table) {
        if (Array.isArray(JSON.parse(editor.getValue()))) {
          if (rowIndex >= 0) {
            const row = table.querySelector(
              `tbody tr:nth-child(${rowIndex + 1})`
            );
            if (row) {
              const headers = Array.from(
                table.querySelectorAll("thead th")
              ).map((th) => th.textContent);
              const colIndex = headers.indexOf(key);
              if (colIndex >= 0) {
                const cell = row.querySelector(`td:nth-child(${colIndex + 1})`);
                if (cell) {
                  cell.classList.add(
                    h.isParent ? "highlight-parent" : "highlight-diff"
                  );
                }
              }
            }
          }
        } else {
          const rows = table.querySelectorAll("tbody tr");
          rows.forEach((row) => {
            const keyCell = row.querySelector("td:first-child");
            if (keyCell && keyCell.textContent === key) {
              row.querySelectorAll("td").forEach((cell) => {
                cell.classList.add(
                  h.isParent ? "highlight-parent" : "highlight-diff"
                );
              });
            }
          });
        }
      }
    });
  }
}

// Compare button handler
document.getElementById("compare").addEventListener("change", (e) => {
  clearHighlights("left");
  clearHighlights("right");
  if (e.target.checked) {
    try {
      const leftJSON = JSON.parse(leftEditor.getValue());
      const rightJSON = JSON.parse(rightEditor.getValue());

      toggleView("left", "tree");
      toggleView("right", "tree");

      const { leftDiffs, rightDiffs } = compareJSON(leftJSON, rightJSON);
      leftHighlights = leftDiffs;
      rightHighlights = rightDiffs;

      if (leftDiffs.length === 0 && rightDiffs.length === 0) {
        alert("No differences found.");
      } else {
        applyHighlights("left");
        applyHighlights("right");
      }
    } catch (e) {
      alert("Invalid JSON in one or both editors.");
      toggleView("left", "text");
      toggleView("right", "text");
    }
    e.target.checked = false;
  }
});

// JSON comparison function
function compareJSON(obj1, obj2, path = "") {
  const leftDiffs = [];
  const rightDiffs = [];
  const leftLines = leftEditor.getValue().split("\n");
  const rightLines = rightEditor.getValue().split("\n");

  function addDiff(side, diffPath, isParent = false, isArrayIndex = false) {
    const editor = side === "left" ? leftEditor : rightEditor;
    const lines = side === "left" ? leftLines : rightLines;
    let line = null;
    if (diffPath !== "root") {
      const key = diffPath.split(".").pop();
      const regex = isArrayIndex
        ? new RegExp(`\\[${key}\\]\\s*:`)
        : new RegExp(`"${key}"\\s*:`);
      lines.forEach((lineText, index) => {
        if (lineText.match(regex)) {
          line = index;
        }
      });
    }
    (side === "left" ? leftDiffs : rightDiffs).push({
      path: diffPath,
      line,
      isParent,
      isArrayIndex,
    });
  }

  function compare(obj1, obj2, currentPath) {
    if (obj1 === obj2) return;

    if (typeof obj1 !== typeof obj2 || obj1 === null || obj2 === null) {
      addDiff("left", currentPath);
      addDiff("right", currentPath);
      const parentPath = currentPath.split(".").slice(0, -1).join(".");
      if (parentPath) {
        const isArrayIndex = /^\d+$/.test(currentPath.split(".").pop());
        addDiff("left", parentPath, true, isArrayIndex);
        addDiff("right", parentPath, true, isArrayIndex);
      }
      return;
    }

    if (typeof obj1 === "object" && obj1 !== null) {
      const isArray = Array.isArray(obj1);
      const keys = new Set([
        ...Object.keys(obj1 || {}),
        ...Object.keys(obj2 || {}),
      ]);
      let hasDiffs = false;

      for (const key of keys) {
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        const isArrayIndex = isArray && /^\d+$/.test(key);

        if (!obj2.hasOwnProperty(key)) {
          addDiff("left", newPath, false, isArrayIndex);
          hasDiffs = true;
        } else if (!obj1.hasOwnProperty(key)) {
          addDiff("right", newPath, false, isArrayIndex);
          hasDiffs = true;
        } else if (JSON.stringify(obj1[key]) !== JSON.stringify(obj2[key])) {
          addDiff("left", newPath, false, isArrayIndex);
          addDiff("right", newPath, false, isArrayIndex);
          hasDiffs = true;
          compare(obj1[key], obj2[key], newPath);
        } else {
          compare(obj1[key], obj2[key], newPath);
        }
      }

      if (hasDiffs && currentPath) {
        const isArrayIndex = /^\d+$/.test(currentPath.split(".").pop());
        addDiff("left", currentPath, true, isArrayIndex);
        addDiff("right", currentPath, true, isArrayIndex);
      }
    } else if (obj1 !== obj2) {
      addDiff("left", currentPath);
      addDiff("right", currentPath);
      const parentPath = currentPath.split(".").slice(0, -1).join(".");
      if (parentPath) {
        const isArrayIndex = /^\d+$/.test(currentPath.split(".").pop());
        addDiff("left", parentPath, true, isArrayIndex);
        addDiff("right", parentPath, true, isArrayIndex);
      }
    }
  }

  compare(obj1, obj2, "");
  return { leftDiffs, rightDiffs };
}

// Global clipboard
let clipboard = null;

// Inject Copy/Paste Dropdown
function createActionMenu(path, side) {
  const wrapper = document.createElement("div");
  wrapper.style.display = "inline-block";
  wrapper.style.marginLeft = "8px";

  const button = document.createElement("button");
  button.innerHTML = "⋮";
  button.className = "text-[#f8f8f2] bg-[#49483e] hover:bg-[#555] rounded px-1";
  button.style.cursor = "pointer";

  const menu = document.createElement("div");
  menu.className =
    "absolute bg-[#49483e] text-white rounded shadow p-1 hidden z-50";
  menu.style.marginTop = "5px";

  const actions = ["Copy", "Paste"];
  actions.forEach((action) => {
    const item = document.createElement("div");
    item.className = "hover:bg-[#555] px-2 py-1 cursor-pointer";
    item.textContent = action;
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      handleAction(action, path, side);
      menu.classList.add("hidden");
    });
    menu.appendChild(item);
  });

  wrapper.appendChild(button);
  wrapper.appendChild(menu);

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".json-tree div.absolute").forEach((el) => {
      if (el !== menu) el.classList.add("hidden");
    });
    menu.classList.toggle("hidden");
  });

  document.addEventListener("click", () => {
    menu.classList.add("hidden");
  });

  return wrapper;
}

function handleAction(action, path, side) {
  const editor = side === "left" ? leftEditor : rightEditor;
  const viewMode = side === "left" ? leftViewMode : rightViewMode;

  // Restrict paste to tree view only
  if (action === "Paste" && viewMode !== "tree") {
    alert("Paste is only allowed in Tree view.");
    console.warn("Paste attempted in non-tree view:", {
      side,
      viewMode,
      path,
    });
    return;
  }

  let json;
  try {
    json = JSON.parse(editor.getValue());
  } catch (e) {
    alert("Invalid JSON: " + e.message);
    console.error("JSON Parse Error:", e.message);
    return;
  }

  // Handle the root case
  if (path === "root") {
    if (action === "Copy") {
      clipboard = JSON.parse(JSON.stringify(json)); // Deep copy
    } else if (action === "Paste" && clipboard != null) {
      try {
        editor.setValue(JSON.stringify(clipboard, null, 2));

        toggleView(side, viewMode);
      } catch (e) {
        alert("Error pasting at root: " + e.message);
        console.error("Paste Error at root:", e.message);
      }
    } else if (action === "Paste") {
      alert("Cannot paste: Clipboard is empty.");
      console.warn("Paste attempted with empty clipboard at root.");
    }
    return;
  }

  // Navigate to the parent object or array
  const keys = path.split(".");
  const lastKey = keys.pop();
  let parent = json;
  let currentPath = [];

  try {
    for (const key of keys) {
      currentPath.push(key);
      parent = parent[isNaN(key) ? key : parseInt(key)];
      if (!parent) throw new Error(`Invalid path segment: ${key}`);
    }
  } catch (e) {
    alert("Invalid path: " + e.message);
    console.error("Path Navigation Error:", e.message, {
      path,
      currentPath,
    });
    return;
  }

  if (action === "Copy") {
    if (!parent.hasOwnProperty(lastKey)) {
      alert("Key does not exist in JSON.");
      console.error("Key not found:", { lastKey, parent });
      return;
    }

    clipboard = JSON.parse(JSON.stringify(parent[lastKey])); // Deep copy

    // Ensure the data is copied to system clipboard for external usage
    try {
      // Convert the data to a string before copying
      const clipboardContent = JSON.stringify(clipboard, null, 2);

      // Use the Clipboard API to copy to system clipboard if available, otherwise fallback
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(clipboardContent)
          .then(() => {
            console.log("Successfully copied to clipboard");
          })
          .catch((err) => {
            console.error("Failed to copy to clipboard: ", err);
            copyToClipboardFallback(clipboardContent);
          });
      } else {
        copyToClipboardFallback(clipboardContent);
      }
    } catch (e) {
      alert("Error copying to clipboard: " + e.message);
      console.error("Clipboard Error:", e.message);
    }
  } else if (action === "Paste" && clipboard != null) {
    if (!Array.isArray(parent) && typeof parent !== "object") {
      alert("Can only paste into arrays or objects.");
      console.error("Invalid paste target:", { parent, path });
      return;
    }

    try {
      if (Array.isArray(parent)) {
        parent.push(JSON.parse(JSON.stringify(clipboard))); // Deep copy
      } else {
        const newKey = generateUniqueKey(parent);
        parent[newKey] = JSON.parse(JSON.stringify(clipboard)); // Deep copy
      }

      editor.setValue(JSON.stringify(json, null, 2));
      toggleView(side, viewMode);
    } catch (e) {
      alert("Error pasting: " + e.message);
      console.error("Paste Error:", e.message, { path, clipboard });
    }
  } else if (action === "Paste") {
    alert("Cannot paste: Clipboard is empty.");
    console.warn("Paste attempted with empty clipboard.");
  }
}

function generateUniqueKey(obj) {
  let i = 1;
  while (obj.hasOwnProperty("newKey" + i)) i++;
  return "newKey" + i;
}

// Override renderJSONTree and createTreeNode
const originalRenderJSONTree = renderJSONTree;
renderJSONTree = function (container, json, side) {
  try {
    const data = JSON.parse(json);
    const tree = document.createElement("div");
    tree.className = "json-tree";
    tree.appendChild(createTreeNode(data, "", true, "", side));
    container.innerHTML = "";
    container.appendChild(tree);
  } catch (e) {
    alert("Invalid JSON for tree view: " + e.message);
    toggleView(container.id.includes("left") ? "left" : "right", "text");
  }
};
