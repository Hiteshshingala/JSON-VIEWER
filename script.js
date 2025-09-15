
var gk_isXlsx = false;
var gk_xlsxFileLookup = {};
var gk_fileData = {};

function filledCell(cell) {
  return cell !== "" && cell != null;
}

function loadFileData(filename) {
  if (gk_isXlsx && gk_xlsxFileLookup[filename]) {
    try {
      var workbook = XLSX.read(gk_fileData[filename], {
        type: "base64"
      });
      var firstSheetName = workbook.SheetNames[0];
      var worksheet = workbook.Sheets[firstSheetName];
      var jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        blankrows: false,
        defval: ""
      });
      var filteredData = jsonData.filter((row) => row.some(filledCell));
      var headerRowIndex = filteredData.findIndex((row, index) => row.filter(filledCell).length >= filteredData[index + 1]?.filter(filledCell).length);
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
const leftEditor = CodeMirror.fromTextArea(document.getElementById("left-editor"), {
  mode: "application/json",
  height: "100%",
  theme: "monokai",
  lineNumbers: true,
  lineWrapping: true,
  matchBrackets: true,
  autoCloseBrackets: true
});

const rightEditor = CodeMirror.fromTextArea(document.getElementById("right-editor"), {
  mode: "application/json",
  height: "100%",
  theme: "monokai",
  lineNumbers: true,
  lineWrapping: true,
  matchBrackets: true,
  autoCloseBrackets: true
});

// Theme toggle functionality
$(document).ready(function () { // Load saved theme from localStorage
  const savedTheme = localStorage.getItem("theme") || "dark";
  if (savedTheme === "light") {
    $("body").attr("data-theme", "light");
    $("#theme-toggle").prop("checked", true);
    leftEditor.setOption("theme", "default");
    rightEditor.setOption("theme", "default");
  } else {
    $("body").attr("data-theme", "dark");
    $("#theme-toggle").prop("checked", false);
    leftEditor.setOption("theme", "monokai");
    rightEditor.setOption("theme", "monokai"); /* Ensure right editor also updates */
  }

  // Toggle theme on checkbox change
  $("#theme-toggle").on("change", function () {
    if ($(this).is(":checked")) {
      $("body").attr("data-theme", "light");
      localStorage.setItem("theme", "light");
      leftEditor.setOption("theme", "default");
      rightEditor.setOption("theme", "default");
    } else {
      $("body").attr("data-theme", "dark");
      localStorage.setItem("theme", "dark");
      leftEditor.setOption("theme", "monokai");
      rightEditor.setOption("theme", "monokai"); /* Ensure right editor also updates */
    }
  });
});

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

function renderJSONTree(container, json, side) {
  try {
    const data = JSON.parse(json);
    const tree = document.createElement("div");
    tree.className = "json-tree";
    // Pass true for `includeActionMenu` for main editor panels
    tree.appendChild(createTreeNode(data, "", true, "", side, true));
    container.innerHTML = "";
    container.appendChild(tree);
  } catch (e) {
    alert("Invalid JSON for tree view: " + e.message);
    toggleView(container.id.includes("left") ? "left" : "right", "text");
  }
}

// New function to render JSON Tree specifically for the modal
function renderModalJSONTree(containerId, json) {
  const container = document.getElementById(containerId);
  try {
    const data = JSON.parse(json);
    const tree = document.createElement("div");
    tree.className = "json-tree"; // Re-use existing tree styling
    tree.appendChild(createTreeNode(data, "", true, "", "modal", false, true));
    container.innerHTML = "";
    container.appendChild(tree);
  } catch (e) {
    container.innerHTML = `<pre style="color: red;">Invalid JSON: ${e.message
      }</pre>`;
    console.error(`Error rendering JSON tree in modal (${containerId}):`, e);
  }
}


function createTreeNode(data, key = "", isRoot = false, path = "", side = "left", // 'left', 'right', or 'modal'
  includeActionMenu = true, // New parameter to control action menu
  isOpen = false // New parameter to control initial open state
) {
  const li = document.createElement("li");
  li.id = `node-${side}-${path || "root"
    }`; // Make ID unique per side/modal
  if (typeof data === "object" && data !== null) {
    const isArray = Array.isArray(data);
    const toggle = document.createElement("span");
    toggle.className = "toggle";
    // Only the toggle icon should expand/collapse
    toggle.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent event from bubbling up to li if any parent listener exists
      toggle.classList.toggle("open");
      ul.style.display = ul.style.display === "none" ? "block" : "none";
    });

    const keySpan = document.createElement("span");
    keySpan.className = `cm-property ${isArray ? "array" : "object"
      }`;
    keySpan.id = `key-${side}-${path || "root"
      }`; // Make ID unique per side/modal
    keySpan.textContent = key ? `${key}: ` : isArray ? "Array" : "Object";
    li.appendChild(toggle);
    li.appendChild(keySpan);

    // Add action menu only if includeActionMenu is true
    if (includeActionMenu && (Array.isArray(data) || (typeof data === "object" && data !== null))) {
      li.appendChild(createActionMenu(path || "root", side));
    }

    const ul = document.createElement("ul");
    // Set initial display based on isOpen or isRoot
    ul.style.display = (isRoot || isOpen) ? "block" : "none";
    if (isRoot || isOpen) {
      toggle.classList.add("open");
    }

    if (isArray) {
      data.forEach((item, index) => {
        const childPath = path ? `${path}.${index}` : `${index}`;
        const childLi = createTreeNode(item, `[${index}]`, false, childPath, side, includeActionMenu, // Pass the flag down
          isOpen // Pass the flag down
        );
        ul.appendChild(childLi);
      });
    } else {
      Object.entries(data).forEach(([k, v]) => {
        const childPath = path ? `${path}.${k}` : k;
        const childLi = createTreeNode(v, k, false, childPath, side, includeActionMenu, isOpen); // Pass the flag down
        ul.appendChild(childLi);
      });
    } li.appendChild(ul);
  } else {
    const keySpan = document.createElement("span");
    keySpan.className = "cm-property";
    keySpan.id = `key-${side}-${path || "root"
      }`; // Make ID unique per side/modal
    keySpan.textContent = key ? `${key}: ` : "";

    const valueSpan = document.createElement("span");
    valueSpan.className = typeof data === "string" ? "cm-string" : typeof data === "number" ? "cm-number" : typeof data === "boolean" ? "cm-boolean" : "cm-null";
    valueSpan.id = `value-${side}-${path || "root"
      }`; // Make ID unique per side/modal
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
    table.className = "w-full text-[var(--text-color)] border-collapse font-mono text-xs";
    const tbody = document.createElement("tbody");
    if (Array.isArray(data)) {
      const headers = Object.keys(data[0] || {});
      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");
      headers.forEach((key) => {
        const th = document.createElement("th");
        th.className = "border border-[var(--border-color)] p-2 cm-property";
        th.textContent = key;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);
      data.forEach((item) => {
        const tr = document.createElement("tr");
        headers.forEach((key) => {
          const td = document.createElement("td");
          td.className = "border border-[var(--border-color)] p-2";
          const value = item[key];
          td.className += " " + (
            typeof value === "string" ? "cm-string" : typeof value === "number" ? "cm-number" : typeof value === "boolean" ? "cm-boolean" : value === null ? "cm-null" : ""
          );
          td.textContent = JSON.stringify(value || "");
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    } else {
      Object.entries(data).forEach(([key, value]) => {
        const tr = document.createElement("tr");
        const tdKey = document.createElement("td");
        tdKey.className = "border border-[var(--border-color)] p-2 cm-property";
        tdKey.textContent = key;
        const tdValue = document.createElement("td");
        tdValue.className = "border border-[var(--border-color)] p-2";
        tdValue.className += " " + (
          typeof value === "string" ? "cm-string" : typeof value === "number" ? "cm-number" : typeof value === "boolean" ? "cm-boolean" : value === null ? "cm-null" : ""
        );
        tdValue.textContent = JSON.stringify(value);
        tr.appendChild(tdKey);
        tr.appendChild(tdValue);
        tbody.appendChild(tr);
      });
    } table.appendChild(tbody);
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
    table: document.getElementById(`table-${side}`)
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

  // Update button styles based on current theme
  const isDarkTheme = $("body").attr("data-theme") === "dark";
  const activeBg = isDarkTheme ? "#272822" : "#f8f8f8";
  const activeText = isDarkTheme ? "#a6e22e" : "#2f855a";
  const inactiveBg = isDarkTheme ? "#a6e22e" : "#a6e22e";
  const inactiveText = isDarkTheme ? "#272822" : "#1f2937";

  Object.values(buttons).forEach((btn) => {
    btn.style.backgroundColor = inactiveBg;
    btn.style.color = inactiveText;
    btn.classList.remove("font-semibold");
  });
  buttons[mode].style.backgroundColor = activeBg;
  buttons[mode].style.color = activeText;
  buttons[mode].classList.add("font-semibold");


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
  } container.innerHTML = "";
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
  if (side === "left")
    leftViewMode = mode;
  else
    rightViewMode = mode;
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
        let fileContent;
        if (file.name.endsWith(".xlsx")) {
          gk_isXlsx = true;
          gk_xlsxFileLookup[file.name] = true;
          gk_fileData[file.name] = event.target.result.split(",")[1];
          fileContent = loadFileData(file.name);
        } else {
          fileContent = event.target.result;
        } editor.setValue(fileContent);
        toggleView(input.id.includes("left") ? "left" : "right", "text");

        // Update Original and Preview in the Transform modal if it's the left editor
        if (input.id === "file-left") { // Now render as tree in the modal
          renderModalJSONTree("original-json-tree-container", fileContent);
          renderModalJSONTree("preview-json-tree-container", fileContent); // Initially same as original
          populateWizardOptions(JSON.parse(fileContent));
          updateQueryAndPreview();
        }
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
  // Clear Transform modal content
  document.getElementById("original-json-tree-container").innerHTML = "";
  document.getElementById("preview-json-tree-container").innerHTML = "";
  resetWizardOptions();
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
      type: "application/json"
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
      type: "application/json"
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
  } container.querySelectorAll(".highlight-diff, .highlight-parent").forEach((el) => {
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
        const lineHandle = editor.addLineClass(h.line, "background", h.isParent ? "highlight-parent" : "highlight-diff");
        highlights[highlights.indexOf(h)] = {
          ...h,
          clear: () => editor.removeLineClass(lineHandle, "background", h.isParent ? "highlight-parent" : "highlight-diff")
        };
      }
    });
  } else if (viewMode === "tree") {
    highlights.forEach((h) => { // Ensure IDs are unique for each side
      const keyId = `key-${side}-${h.path.replace(/\./g, "\\.")
        }`;
      const valueId = `value-${side}-${h.path.replace(/\./g, "\\.")
        }`;
      const nodeId = `node-${side}-${h.path.replace(/\./g, "\\.")
        }`;

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
      const rowIndex = pathParts.length > 1 ? parseInt(pathParts[pathParts.length - 2]) : -1;
      const key = pathParts[path.length - 1];
      const table = container.querySelector("table");
      if (table) {
        if (Array.isArray(JSON.parse(editor.getValue()))) {
          if (rowIndex >= 0) {
            const row = table.querySelector(`tbody tr:nth-child(${rowIndex + 1
              })`);
            if (row) {
              const headers = Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent);
              const colIndex = headers.indexOf(key);
              if (colIndex >= 0) {
                const cell = row.querySelector(`td:nth-child(${colIndex + 1
                  })`);
                if (cell) {
                  cell.classList.add(h.isParent ? "highlight-parent" : "highlight-diff");
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
                cell.classList.add(h.isParent ? "highlight-parent" : "highlight-diff");
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

      const {
        leftDiffs,
        rightDiffs
      } = compareJSON(leftJSON, rightJSON);
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
      const regex = isArrayIndex ? new RegExp(`\\[${key}\\]\\s*:`) : new RegExp(`"${key}"\\s*:`);
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
      isArrayIndex
    });
  }

  function compare(obj1, obj2, currentPath) {
    if (obj1 === obj2)
      return;



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
  return {
    leftDiffs,
    rightDiffs
  };
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
  button.className = "text-[var(--text-color)] bg-[var(--border-color)] hover:bg-[#555] rounded px-1";
  button.style.cursor = "pointer";

  const menu = document.createElement("div");
  menu.className = "absolute bg-[var(--border-color)] text-[var(--text-color)] rounded shadow p-1 hidden z-50";
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
      if (el !== menu)
        el.classList.add("hidden");


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
      path
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
      if (!parent)
        throw new Error(`Invalid path segment: ${key}`);


    }
  } catch (e) {
    alert("Invalid path: " + e.message);
    console.error("Path Navigation Error:", e.message, {
      path,
      currentPath
    });
    return;
  }

  if (action === "Copy") {
    if (!parent.hasOwnProperty(lastKey)) {
      alert("Key does not exist in JSON.");
      console.error("Key not found:", {
        lastKey,
        parent
      });
      return;
    }

    clipboard = JSON.parse(JSON.stringify(parent[lastKey]));
    // Deep copy

    // Ensure the data is copied to system clipboard for external usage
    try { // Convert the data to a string before copying
      const clipboardContent = JSON.stringify(clipboard, null, 2);

      // Use the Clipboard API to copy to system clipboard if available, otherwise fallback
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(clipboardContent).then(() => {
          console.log("Successfully copied to clipboard");
        }).catch((err) => {
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
      console.error("Invalid paste target:", {
        parent,
        path
      });
      return;
    }

    try {
      if (Array.isArray(parent)) {
        parent.push(JSON.parse(JSON.stringify(clipboard))); // Deep copy
      } else {
        const newKey = generateUniqueKey(parent);
        parent[newKey] = JSON.parse(JSON.stringify(clipboard)); // Deep copy
      } editor.setValue(JSON.stringify(json, null, 2));
      toggleView(side, viewMode);
    } catch (e) {
      alert("Error pasting: " + e.message);
      console.error("Paste Error:", e.message, {
        path,
        clipboard
      });
    }
  } else if (action === "Paste") {
    alert("Cannot paste: Clipboard is empty.");
    console.warn("Paste attempted with empty clipboard.");
  }
}

function copyToClipboardFallback(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand("copy");
    console.log("Fallback: Successfully copied to clipboard");
  } catch (err) {
    console.error("Fallback: Failed to copy to clipboard", err);
  }
  document.body.removeChild(textArea);
}

function generateUniqueKey(obj) {
  let i = 1;
  while (obj.hasOwnProperty("newKey" + i))
    i++;


  return "newKey" + i;
}

// Popup Logic
document.getElementById("popup-button").addEventListener("click", function () {
  document.getElementById("popup-modal").classList.remove("hidden");
  // When the popup opens, update the Original and Preview sections with tree view
  const currentLeftEditorContent = leftEditor.getValue();
  renderModalJSONTree("original-json-tree-container", currentLeftEditorContent);
  populateWizardOptions(JSON.parse(currentLeftEditorContent));
  updateQueryAndPreview(); // Initial update
});

document.getElementById("close-popup").addEventListener("click", function () {
  document.getElementById("popup-modal").classList.add("hidden");
});

// Settings Dropdown Logic
document.getElementById("settings-button").addEventListener("click", function (event) {
  event.stopPropagation(); // Prevent the document click listener from immediately closing it
  document.getElementById("settings-dropdown").classList.toggle("show");
});

// Close the dropdown if the user clicks outside of it
window.addEventListener("click", function (event) {
  const dropdown = document.getElementById("settings-dropdown");
  const settingsButton = document.getElementById("settings-button");
  if (!settingsButton.contains(event.target) && !dropdown.contains(event.target)) {
    dropdown.classList.remove("show");
  }
});

// --- Transform Modal Language and Query Logic ---
const languageDescription = document.getElementById('language-description');
const queryTextarea = document.getElementById('query');
const settingsDropdown = document.getElementById('settings-dropdown');
const filterKeyTreeSelect = document.getElementById('filter-key-tree-select');
const filterKeySelected = filterKeyTreeSelect.querySelector('.selected');
const filterKeyDropdown = filterKeyTreeSelect.querySelector('.dropdown');
const clearFilterButton = document.getElementById('clear-filter'); // New: Clear Filter button

const filterOperatorSelect = document.getElementById('filter-operator');
const filterValueInput = document.getElementById('filter-value');

const sortKeyTreeSelect = document.getElementById('sort-key-tree-select');
const sortKeySelected = sortKeyTreeSelect.querySelector('.selected');
const sortKeyDropdown = sortKeyTreeSelect.querySelector('.dropdown');
const clearSortButton = document.getElementById('clear-sort'); // New: Clear Sort button

const sortOrderSelect = document.getElementById('sort-order');
const pickKeysTreeSelect = document.getElementById('pick-keys-tree-select'); // New: Pick keys tree-select
const pickKeysSelected = pickKeysTreeSelect.querySelector('.selected'); // New: Pick keys selected div
const pickKeysDropdown = pickKeysTreeSelect.querySelector('.dropdown'); // New: Pick keys dropdown ul
const clearPickButton = document.getElementById('clear-pick'); // New: Clear Pick button

const transformButton = document.getElementById('transform-button');

let currentOriginalData = null;
let selectedPickKeys = new Set(); // To store multiple selected pick keys

function updateTransformModalContent(language) {
  let descriptionHtml = '';
  let queryTemplate = '';

  switch (language) {
    case 'javascript':
      descriptionHtml = `
            Enter a <a href="#" class="text-blue-600 underline hover:text-blue-700">JavaScript</a> function to filter, sort, or transform the data. You can use
            Lodash functions like
            <code class="bg-gray-200 rounded px-1 font-mono text-xs text-gray-800">_.map</code>,
            <code class="bg-gray-200 rounded px-1 font-mono text-xs text-gray-800">_.filter</code>,
            <code class="bg-gray-200 rounded px-1 font-mono text-xs text-gray-800">_.orderBy</code>,
            <code class="bg-gray-200 rounded px-1 font-mono text-xs text-gray-800">_.sortBy</code>,
            <code class="bg-gray-200 rounded px-1 font-mono text-xs text-gray-800">_.groupBy</code>,
            <code class="bg-gray-200 rounded px-1 font-mono text-xs text-gray-800">_.pick</code>,
            <code class="bg-gray-200 rounded px-1 font-mono text-xs text-gray-800">_.uniq</code>,
            <code class="bg-gray-200 rounded px-1 font-mono text-xs text-gray-800">_.get</code>, etcetera.
          `;
      queryTemplate = `function query (data) {
            return _.chain(data)
              .value()
          }`;
      break;
    default:
      descriptionHtml = `
            Enter a
            <a href="#" class="text-blue-600 underline hover:text-blue-700">JSON Query</a>
            function to filter, sort, or transform the data. You can use
            functions like
            <code class="bg-gray-200 rounded px-1 font-mono text-xs text-gray-800">get</code>,
            <code class="bg-gray-200 rounded px-1 font-mono text-xs text-gray-800">filter</code>,
            <code class="bg-gray-200 rounded px-1 font-mono text-xs text-gray-800">sort</code>,
            <code class="bg-gray-200 rounded px-1 font-mono text-xs text-gray-800">pick</code>,
            <code class="bg-gray-200 rounded px-1 font-mono text-xs text-gray-800">groupBy</code>,
            <code class="bg-gray-200 rounded px-1 font-mono text-xs text-gray-800">uniq</code>, etcetera. Example
            query:
            <code class="bg-gray-200 rounded px-1 font-mono text-xs text-gray-800">filter(.age &gt;= 18)</code>
          `;
      queryTemplate = '';
      break;
  }

  languageDescription.innerHTML = descriptionHtml;
  queryTextarea.value = queryTemplate;
}

// Function to extract all unique keys from a JSON object/array of objects, including nested keys
function getAllKeys(data, prefix = '') {
  const keys = new Set();

  function recurse(currentData, currentPath) {
    if (typeof currentData === 'object' && currentData !== null) {
      if (Array.isArray(currentData)) {
        currentData.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            recurse(item, currentPath); // Recurse into array items' keys
          }
        });
      } else {
        Object.keys(currentData).forEach(key => {
          const newPath = currentPath ? `${currentPath}.${key}` : key;
          // Always add the full path of the current key
          keys.add(newPath);
          // Recurse into nested objects/arrays
          recurse(currentData[key], newPath);
        });
      }
    }
  }

  recurse(data, prefix);
  return Array.from(keys).sort();
}

// Helper to build nested tree-select options
function buildTreeOptions(keys, containerElement, isMultiSelect = false) {
  containerElement.innerHTML = ''; // Clear existing options
  const root = {};

  keys.forEach(key => {
    const parts = key.split('.');
    let current = root;
    parts.forEach((part, i) => {
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
      if (i === parts.length - 1) {
        current.__value = key; // Store the full path
      }
    });
  });

  function createList(node, currentPath = '') {
    const ul = document.createElement('ul');
    ul.classList.add('children');
    if (currentPath !== '') {
      ul.classList.add('hidden'); // Hide children by default
    }

    for (const key in node) {
      if (key === '__value') continue;

      const li = document.createElement('li');
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      li.dataset.path = newPath; // Add data-path for easier selection/disabling

      // Check if the current node has children (i.e., it's a parent object/array)
      const hasChildren = Object.keys(node[key]).length > (node[key].__value ? 1 : 0);

      if (hasChildren) {
        const toggleSpan = document.createElement('span');
        toggleSpan.classList.add('parent-toggle');
        toggleSpan.textContent = ''; // Content will be set by CSS pseudo-element
        li.appendChild(toggleSpan);

        const keySpan = document.createElement('span');
        keySpan.textContent = key;
        keySpan.classList.add('parent'); // Keep parent class for styling if needed
        // For multi-select, parent nodes are also selectable as individual keys
        if (isMultiSelect) {
          // Only add data-value and class if it's a selectable parent (i.e., not just a container for children)
          // In this specific case, we want parent *objects* to be selectable as a whole,
          // but not automatically select their children.
          keySpan.dataset.value = newPath;
          keySpan.classList.add('tree-option-multi');
        }
        li.appendChild(keySpan);

        li.appendChild(createList(node[key], newPath));
      } else {
        // This is a leaf node (a property with a primitive value)
        li.textContent = key;
        li.dataset.value = newPath; // Store full path
        if (isMultiSelect) {
          li.classList.add('tree-option-multi'); // Add a class for easier selection
        } else {
          li.classList.add('tree-option'); // Add a class for easier selection
        }
      }
      ul.appendChild(li);
    }
    return ul;
  }

  containerElement.appendChild(createList(root));
}


// Populate filter, sort, and pick dropdowns
function populateWizardOptions(data) {
  currentOriginalData = data; // Store original data for transformations
  const keys = getAllKeys(data);

  // Populate Filter Key Tree Select
  buildTreeOptions(keys, filterKeyDropdown);
  filterKeySelected.textContent = "Please select";
  filterKeyTreeSelect.dataset.value = ""; // Clear selected value
  clearFilterButton.style.display = 'none'; // Hide clear button initially

  // Populate Sort Key Tree Select
  buildTreeOptions(keys, sortKeyDropdown);
  sortKeySelected.textContent = "Please select";
  sortKeyTreeSelect.dataset.value = ""; // Clear selected value
  clearSortButton.style.display = 'none'; // Hide clear button initially

  // Populate Pick Keys Tree Select (multi-select)
  buildTreeOptions(keys, pickKeysDropdown, true); // Pass true for isMultiSelect
  updatePickKeysSelectedDisplay(); // Update display based on selectedPickKeys

  // Re-attach event listeners for tree-select options
  attachTreeSelectListeners();
}

// Attach event listeners for the custom tree-select dropdowns
function attachTreeSelectListeners() {
  // Handle parent clicks for filter and sort tree-selects (text part)
  document.querySelectorAll("#filter-key-tree-select .parent, #sort-key-tree-select .parent").forEach(parent => {
    parent.removeEventListener("click", handleParentClick); // Prevent duplicate listeners
    parent.addEventListener("click", handleParentClick);
  });

  // Handle parent toggle clicks for all tree-selects, including pick
  document.querySelectorAll(".tree-select .parent-toggle").forEach(toggle => {
    toggle.removeEventListener("click", handleParentToggleClick); // Prevent duplicate listeners
    toggle.addEventListener("click", handleParentToggleClick);
  });

  // Handle single option selection for filter and sort tree-selects (leaf nodes)
  document.querySelectorAll("#filter-key-tree-select .tree-option, #sort-key-tree-select .tree-option").forEach(option => {
    option.removeEventListener("click", handleTreeOptionClick); // Prevent duplicate listeners
    option.addEventListener("click", handleTreeOptionClick);
  });

  // Handle multi-option selection for pick keys tree-select (both leaf and parent nodes)
  document.querySelectorAll("#pick-keys-tree-select .tree-option-multi").forEach(option => {
    option.removeEventListener("click", handlePickKeyClick); // Prevent duplicate listeners
    option.addEventListener("click", handlePickKeyClick);
  });

  // Toggle dropdown for filter tree-select
  filterKeySelected.removeEventListener("click", toggleFilterDropdown);
  filterKeySelected.addEventListener("click", toggleFilterDropdown);

  // Toggle dropdown for sort tree-select
  sortKeySelected.removeEventListener("click", toggleSortDropdown);
  sortKeySelected.addEventListener("click", toggleSortDropdown);

  // Toggle dropdown for pick keys tree-select
  pickKeysSelected.removeEventListener("click", togglePickKeysDropdown);
  pickKeysSelected.addEventListener("click", togglePickKeysDropdown);

  // New: Add event listeners for clear buttons
  clearFilterButton.addEventListener('click', clearFilter);
  clearSortButton.addEventListener('click', clearSort);
  clearPickButton.addEventListener('click', clearPick);
}

function handleParentClick() {
  // This function is for the text part of the parent, not the toggle icon.
  // The actual toggling is now handled by handleParentToggleClick.
  // For filter/sort, clicking the text should select it if it's a leaf.
  // For pick, clicking the text should select/deselect it.
  // No change needed here for the toggle behavior.
}

// NEW: Function to handle clicks on the parent toggle icon
function handleParentToggleClick(event) {
  event.stopPropagation(); // Prevent event from bubbling up to parent li or selected div
  const children = this.nextElementSibling.nextElementSibling; // Skip the keySpan to get the <ul>
  if (children) {
    this.classList.toggle("open");
    children.classList.toggle("hidden");
  }
  // REMOVED: The call to handlePickKeyClick here.
  // Clicking the toggle icon should ONLY expand/collapse, not select the key.
}

function handleTreeOptionClick() {
  const parentTreeSelect = this.closest('.tree-select');
  const selectedDiv = parentTreeSelect.querySelector('.selected');
  const dropdownUl = parentTreeSelect.querySelector('.dropdown');
  const clearBtn = parentTreeSelect.querySelector('.clear-button'); // Get the clear button

  selectedDiv.textContent = this.textContent;
  parentTreeSelect.dataset.value = this.dataset.value; // Store the actual value
  dropdownUl.classList.add("hidden");
  clearBtn.style.display = 'block'; // Show clear button
  updateQueryAndPreview();
}

// Modified handler for "Pick" options (no checkbox)
function handlePickKeyClick(event) {
  event.stopPropagation(); // Prevent event from bubbling up to parent li or selected div
  const key = event.target.dataset.value; // Get the full path from data-value

  // Only toggle selection if the clicked element has a data-value (i.e., it's a selectable key)
  if (key) {
    if (selectedPickKeys.has(key)) {
      selectedPickKeys.delete(key);
    } else {
      selectedPickKeys.add(key);
    }
    updatePickKeysSelectedDisplay();
    updateQueryAndPreview();
  }
}

function updatePickKeysSelectedDisplay() {
  pickKeysSelected.innerHTML = ''; // Clear current display
  if (selectedPickKeys.size === 0) {
    const placeholder = document.createElement('span');
    placeholder.className = 'placeholder';
    placeholder.textContent = 'Select keys to pick';
    pickKeysSelected.appendChild(placeholder);
    clearPickButton.style.display = 'none'; // Hide clear button
  } else {
    selectedPickKeys.forEach(key => {
      const tag = document.createElement('span');
      tag.className = 'bg-[var(--transform-modal-details-bg)] border border-[var(--transform-modal-input-border)] rounded px-2 py-1 text-xs flex items-center mr-1 mb-1';
      tag.textContent = key.split('.').pop(); // Display only the last part of the key
      const removeBtn = document.createElement('button');
      removeBtn.className = 'ml-1 text-[var(--transform-modal-text)] hover:text-red-500';
      removeBtn.innerHTML = '&times;';
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        selectedPickKeys.delete(key);
        updatePickKeysSelectedDisplay();
        updateQueryAndPreview();
      };
      tag.appendChild(removeBtn);
      pickKeysSelected.appendChild(tag);
    });
    clearPickButton.style.display = 'block'; // Show clear button
  }
  // Visually mark selected items in the dropdown
  document.querySelectorAll("#pick-keys-tree-select .tree-option-multi").forEach(option => {
    if (selectedPickKeys.has(option.dataset.value)) {
      option.style.backgroundColor = 'var(--transform-modal-hover-bg)';
      option.style.color = 'var(--transform-modal-header-text)';
    } else {
      option.style.backgroundColor = '';
      option.style.color = '';
    }
  });

  // --- New Logic for disabling/enabling sub-objects ---
  const allPickOptions = pickKeysDropdown.querySelectorAll('.tree-option-multi');
  allPickOptions.forEach(option => {
    option.classList.remove('disabled'); // Reset all to enabled
  });

  selectedPickKeys.forEach(selectedKey => {
    // If a parent key is selected, disable all its children
    allPickOptions.forEach(option => {
      const optionPath = option.dataset.value;
      if (optionPath.startsWith(selectedKey + '.') && optionPath !== selectedKey) {
        option.classList.add('disabled');
        // Also remove from selectedPickKeys if it's a child of a newly selected parent
        if (selectedPickKeys.has(optionPath)) {
          selectedPickKeys.delete(optionPath);
          // Re-render selected tags if a child was deselected
          updatePickKeysSelectedDisplay(); // Recursive call, but safe due to Set operations
        }
      }
    });
  });
  // --- End New Logic ---
}


function toggleFilterDropdown() {
  filterKeyDropdown.classList.toggle("hidden");
  // Close other dropdowns if open
  sortKeyDropdown.classList.add("hidden");
  pickKeysDropdown.classList.add("hidden");
}

function toggleSortDropdown() {
  sortKeyDropdown.classList.toggle("hidden");
  // Close other dropdowns if open
  filterKeyDropdown.classList.add("hidden");
  pickKeysDropdown.classList.add("hidden");
}

function togglePickKeysDropdown() {
  pickKeysDropdown.classList.toggle("hidden");
  // Close other dropdowns if open
  filterKeyDropdown.classList.add("hidden");
  sortKeyDropdown.classList.add("hidden");
}

// Close dropdowns if clicked outside
window.addEventListener('click', function (event) {
  if (!filterKeyTreeSelect.contains(event.target)) {
    filterKeyDropdown.classList.add('hidden');
  }
  if (!sortKeyTreeSelect.contains(event.target)) {
    sortKeyDropdown.classList.add('hidden');
  }
  if (!pickKeysTreeSelect.contains(event.target)) {
    pickKeysDropdown.classList.add('hidden');
  }
});


// Reset wizard options
function resetWizardOptions() {
  filterKeySelected.textContent = "Please select";
  filterKeyTreeSelect.dataset.value = "";
  filterKeyDropdown.innerHTML = ''; // Clear dropdown content
  clearFilterButton.style.display = 'none'; // Hide clear button

  filterOperatorSelect.value = '==';
  filterValueInput.value = '';

  sortKeySelected.textContent = "Please select";
  sortKeyTreeSelect.dataset.value = "";
  sortKeyDropdown.innerHTML = ''; // Clear dropdown content
  clearSortButton.style.display = 'none'; // Hide clear button

  sortOrderSelect.value = 'asc';
  selectedPickKeys.clear(); // Clear selected pick keys
  pickKeysDropdown.innerHTML = ''; // Clear dropdown content
  updatePickKeysSelectedDisplay(); // Update display
  clearPickButton.style.display = 'none'; // Hide clear button

  currentOriginalData = null;
  updateQueryAndPreview(); // Clear query and preview
}

// New: Clear Filter function
function clearFilter() {
  filterKeySelected.textContent = "Please select";
  filterKeyTreeSelect.dataset.value = "";
  filterOperatorSelect.value = '==';
  filterValueInput.value = '';
  clearFilterButton.style.display = 'none';
  updateQueryAndPreview();
}

// New: Clear Sort function
function clearSort() {
  sortKeySelected.textContent = "Please select";
  sortKeyTreeSelect.dataset.value = "";
  sortOrderSelect.value = 'asc';
  clearSortButton.style.display = 'none';
  updateQueryAndPreview();
}

// New: Clear Pick function
function clearPick() {
  selectedPickKeys.clear();
  updatePickKeysSelectedDisplay(); // This will also hide the clear button
  updateQueryAndPreview();
}


// Generate query based on wizard selections
function generateQuery() {
  let query = `function query (data) {let result = _.chain(data)`;

  const filterKey = filterKeyTreeSelect.dataset.value; // Get value from data-value
  const filterOperator = filterOperatorSelect.value;
  const filterValue = filterValueInput.value;

  if (filterKey && filterValue) {
    let parsedFilterValue = filterValue;
    // Attempt to parse number or boolean
    if (!isNaN(filterValue) && !isNaN(parseFloat(filterValue))) {
      parsedFilterValue = parseFloat(filterValue);
    } else if (filterValue.toLowerCase() === 'true') {
      parsedFilterValue = true;
    } else if (filterValue.toLowerCase() === 'false') {
      parsedFilterValue = false;
    } else {
      parsedFilterValue = `'${filterValue}'`; // Treat as string
    }

    // Use _.get for nested properties
    query += `.filter(item => _.get(item, '${filterKey}') ${filterOperator} ${parsedFilterValue})`;
  }

  const sortKey = sortKeyTreeSelect.dataset.value; // Get value from data-value
  const sortOrder = sortOrderSelect.value; // This will be 'asc' or 'desc'

  if (sortKey) {
    query += `
    .orderBy([item => _.get(item, '${sortKey}')], ['${sortOrder}'])`;
  }



  const pickKeys = Array.from(selectedPickKeys); // Get selected values from the Set
  if (pickKeys && pickKeys.length > 0) {
    // const formattedPickKeys = pickKeys.map(key => `'${key}'`).join(', ');
    //         query += `
    // .map(item => _.pick(item, [${formattedPickKeys}]))`;
    //     }

    const formattedPickKeys = JSON.stringify(pickKeys);
    console.log("@@@@@formattedPickKeys", formattedPickKeys);

    query += `
                .map(item => {
                    const result = {};

                    const setDeepValue = (target, pathParts, value) => {
                        let ref = target;
                        for (let i = 0; i < pathParts.length - 1; i++) {
                            const key = pathParts[i];
                            if (_.isArray(ref[key])) {
                                // If it's an array, we assume it's already handled
                                ref = ref[key];
                            } else {
                                if (!ref[key]) {
                                    ref[key] = {};
                                }
                                ref = ref[key];
                            }
                        }
                        ref[pathParts[pathParts.length - 1]] = value;
                    };

                    const pickDeep = (source, target, pathParts) => {
                        if (!source || pathParts.length === 0) return;

                        const key = pathParts[0];
                        const remaining = pathParts.slice(1);
                        const currentValue = source[key];

                        if (_.isArray(currentValue)) {
                            if (!target[key]) target[key] = [];

                            currentValue.forEach((subItem, index) => {
                                if (!target[key][index]) target[key][index] = {};

                                if (remaining.length === 0) {
                                    // Leaf value for array case
                                    target[key][index] = subItem;
                                } else {
                                    pickDeep(subItem, target[key][index], remaining);
                                }
                            });

                        } else if (_.isObject(currentValue)) {
                            if (!target[key]) target[key] = {};

                            if (remaining.length === 0) {
                                // Leaf value for object case
                                target[key] = currentValue;
                            } else {
                                pickDeep(currentValue, target[key], remaining);
                            }

                        } else {
                            if (remaining.length === 0 && currentValue !== undefined) {
                                setDeepValue(target, pathParts, currentValue);
                            }
                        }
                    };

                    ${formattedPickKeys}.forEach(path => {
                        const pathParts = path.split(".");
                        pickDeep(item, result, pathParts);
                    });

                    return result;
                })
            `;
  }


  query += `
        .value()
        return result;
      }`;
  return query;
}

// Update query textarea and preview
function updateQueryAndPreview() {
  const generatedQuery = generateQuery();
  queryTextarea.value = generatedQuery;

  if (currentOriginalData) {
    try {
      const queryFunction = new Function("data", "_", ` ${generatedQuery} return query(data);`);
      const transformedData = queryFunction(currentOriginalData, _); // Pass Lodash as _

      renderModalJSONTree("preview-json-tree-container", JSON.stringify(transformedData, null, 2));
    } catch (e) {
      document.getElementById("preview-json-tree-container").innerHTML = `<pre style="color: red;">Error executing query: ${e.message
        }</pre>`;
      console.error("Error executing query:", e);
    }
  } else {
    document.getElementById("preview-json-tree-container").innerHTML = `<pre style="color: gray;">No data loaded for preview.</pre>`;
  }
}

// Event listeners for wizard controls
filterOperatorSelect.addEventListener('change', updateQueryAndPreview);
filterValueInput.addEventListener('input', updateQueryAndPreview);
sortOrderSelect.addEventListener('change', updateQueryAndPreview);
// No direct listener for pickKeysSelected as changes are handled by checkbox changes

// Event listener for manual query textarea changes
queryTextarea.addEventListener('input', function () {
  if (currentOriginalData) {
    try {
      const customQuery = queryTextarea.value;
      const queryFunction = new Function('data', '_', customQuery.replace('function query (data) {', '').replace('}', ''));
      const transformedData = queryFunction(currentOriginalData, _);
      // renderModalJSONTree("preview-json-tree-container", JSON.stringify(transformedData, null, 2)); // This line was commented out in original
    } catch (e) {
      document.getElementById("preview-json-tree-container").innerHTML = `<pre style="color: red;">Error executing custom query: ${e.message
        }</pre>`;
      console.error("Error executing custom query:", e);
    }
  }
});

// Transform button action

transformButton.addEventListener('click', function () {
  if (currentOriginalData) {
    try {
      const finalQuery = queryTextarea.value;

      // Extract the transformation logic cleanly
      const queryBody = finalQuery
        .replace('function query (data) {', '')
        .replace(/}$/, ''); // Remove only the last closing brace

      const queryFunction = new Function('data', '_', `
                const formattedPickKeys = ${JSON.stringify(Array.from(selectedPickKeys))};
                ${queryBody}
            `);

      const transformedData = queryFunction(currentOriginalData, _);

      rightEditor.setValue(JSON.stringify(transformedData, null, 2));
      toggleView("right", "text");
      document.getElementById("popup-modal").classList.add("hidden");
    } catch (e) {
      alert("Error applying transformation: " + e.message);
      console.error("Transformation application error:", e);
    }
  } else {
    alert("No data loaded to transform.");
  }
});


// Initialize the transform modal content based on the default checked checkbox
document.addEventListener('DOMContentLoaded', () => {
  const initialCheckedCheckbox = document.querySelector('#settings-dropdown input[type="checkbox"]:checked');
  if (initialCheckedCheckbox) {
    updateTransformModalContent(initialCheckedCheckbox.dataset.language);
  } else {
    updateTransformModalContent('javascript'); // Default to JavaScript
  }
  // No longer need Select2 initialization for pick-keys
});
