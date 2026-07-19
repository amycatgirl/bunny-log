import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";
import Paragraph from "@tiptap/extension-paragraph";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Strikethrough from "@tiptap/extension-strike";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import { UndoRedo } from "@tiptap/extensions";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { Editor } from "@tiptap/core";

const TIPTAP = document.getElementById("rt-tiptap");
const RT_TOOLBAR = document.querySelector(".rt > .toolbar");

/** @type {HTMLButtonElement[]} */
const RT_TOOLBAR_BUTTONS = [...RT_TOOLBAR.querySelectorAll("button[id^=rt-tb]")];

const RT_TOOLBAR_FORM_LINK = RT_TOOLBAR.querySelector("form#rt-link");
const RT_TOOLBAR_FORM_COLOUR = RT_TOOLBAR.querySelector("form#rt-colour");
const RT_TOOLBAR_FORM_HL = RT_TOOLBAR.querySelector("form#rt-hl");

const ENCODER = new TextEncoder()

let editor = new Editor({
  element: TIPTAP,
  extensions: [
    Document,
    Text,
    Paragraph,
    Bold,
    Italic,
    Strikethrough,
    Link,
    Highlight.configure({ multicolor: true }),
    TextStyle,
    Color,
    UndoRedo
  ],
  onTransaction(_) {
    for (const element of RT_TOOLBAR_BUTTONS) {
      const type = element.id.replace("rt-tb-", "")

      switch (type) {
        case "bold":
          isBold() ? element.classList.add("active") : element.classList.remove("active")
          break;
        case "italic":
          isItalic() ? element.classList.add("active") : element.classList.remove("active")
          break;
        case "striked":
          isStrike() ? element.classList.add("active") : element.classList.remove("active")
          break;
        case "link":
          isLink() ? element.classList.add("active") : element.classList.remove("active")
          break;
        case "hl":
          isHighlighted() ? element.classList.add("active") : element.classList.remove("active")
          break;
        default:
          break;
      }
    }
  },
  content: "<p>hi</p>"
})

function stringIndexToUtf8Index(string, index) {
  return ENCODER.encode(string.slice(0, index)).byteLength;
}

export function getText() {
  return editor.getText({ blockSeparator: "\n\n" })
}

export function getState() {
  return editor.getJSON()
}

function getMarkRanges(doc) {
  const markRanges = [];
  let currentPos = 0;

  function traverse(node) {
    // Text nodes occupy length equal to text length
    if (node.type === 'text' && node.text) {
      const start = currentPos;
      const end = start + node.text.length;

      if (node.marks && node.marks.length > 0) {
        for (const mark of node.marks) {
          markRanges.push({
            type: mark.type,
            ...(mark.attrs ? { attrs: mark.attrs } : {}),
            from: start,
            to: end,
            text: node.text,
          });
        }
      }

      currentPos = end;
      return;
    }

    // Non-text nodes (like 'doc', 'paragraph', 'heading')
    // Open tag counts as 1 position in ProseMirror/Tiptap document indexing
    const isDoc = node.type === 'doc';
    if (!isDoc) {
      currentPos += 1;
    }

    if (node.content && Array.isArray(node.content)) {
      for (const child of node.content) {
        traverse(child);
      }
    }

    // Close tag counts as 1 position
    if (!isDoc) {
      currentPos += 1;
    }
  }

  traverse(doc);
  return markRanges;
}

function tiptapMarkToFeatureName(mark_name) {
  return mark_name === "textStyle"
    ? "colour"
    : mark_name === "mark"
      ? "highlight"
      : mark_name === "strike"
        ? "strikethrough"
        : mark_name
}

export function documentToFacets(doc, raw) {
  const marks = Object.values(getMarkRanges(doc).reduce((acc, curr) => {
    const key = `${curr.from}:${curr.to}`;
    if (!acc[key]) {
      acc[key] = [];
    }

    acc[key].push(curr);
    return acc
  }, {}));

  let facets = [];

  for (const mark of marks) {
    const range = [mark[0].from, mark[0].to];
    facets.push({
      index: {
        byteStart: stringIndexToUtf8Index(raw, range[0]) + 1,
        byteEnd: stringIndexToUtf8Index(raw, range[1]) - 1
      },
      features: [...mark.map(v => {
        let type = tiptapMarkToFeatureName(v.type)
        if (type === "highlight") {
          console.debug("[RT] HL: ", v.attrs)
        }
        return {
          $type: `internal.bunnylog.facet#${type}`,
          ...(type === "link" ? { uri: v.attrs.href } : {}),
          ...((type === "colour" || type === "highlight") ? { colour: v.attrs.color } : {})
        }
      })]
    })
  }

  return facets
}

export const isBold = () => editor.isActive('bold')
export const isItalic = () => editor.isActive('italic')
export const isStrike = () => editor.isActive('strike')
export const isLink = () => editor.isActive('link')
export const isColoured = () => editor.isActive('textStyle')
export const isHighlighted = () => editor.isActive('highlight')

export const setBold = () => editor.chain().focus().setBold().run()
export const setItalic = () => editor.chain().focus().setItalic().run()
export const setStrike = () => editor.chain().focus().setStrike().run()
export const setLink = (link) => editor.chain().focus().extendMarkRange('link').setLink({ href: link }).run()
export const setColour = (colour) => editor.chain().focus().setColor(colour).run()
export const setHighlight = (colour) => editor.chain().focus().setHighlight({ color: colour }).run()

export const unsetBold = () => editor.chain().focus().unsetBold().run()
export const unsetItalic = () => editor.chain().focus().unsetItalic().run()
export const unsetStrike = () => editor.chain().focus().unsetStrike().run()
export const unsetLink = () => editor.chain().focus().extendMarkRange('link').unsetLink().run()
export const unsetColour = () => editor.chain().focus().unsetColor().run()
export const unsetHighlight = () => editor.chain().focus().unsetHighlight().run()

function toggleExpander(kind) {
  document.querySelector(`.rt .toolbar .expander#rt-tbx-${kind}`).classList.toggle("active");
}

RT_TOOLBAR_FORM_LINK.addEventListener("submit", (ev) => {
  ev.preventDefault();

  const input = RT_TOOLBAR_FORM_LINK.querySelector("#rt-link-url")
  setLink(input.value)
  toggleExpander("link")
})

RT_TOOLBAR_FORM_COLOUR.addEventListener("submit", (ev) => {
  ev.preventDefault();

  const input = RT_TOOLBAR_FORM_COLOUR.querySelector("#rt-colour-hex")
  setColour(input.value)
  toggleExpander("colour")
})

RT_TOOLBAR_FORM_COLOUR.querySelector("#rt-colour-clear").addEventListener("click", (ev) => {
  ev.preventDefault();
  unsetColour()
  toggleExpander("colour")
})

RT_TOOLBAR_FORM_HL.addEventListener("submit", (ev) => {
  ev.preventDefault();

  const input = RT_TOOLBAR_FORM_HL.querySelector("#rt-hl-hex")
  setHighlight(input.value)
  toggleExpander("hl")
})

RT_TOOLBAR_FORM_HL.querySelector("#rt-hl-clear").addEventListener("click", (ev) => {
  ev.preventDefault();
  unsetHighlight()
  toggleExpander("hl")
})

for (const button of RT_TOOLBAR_BUTTONS) {
  console.debug(button)
  const buttonType = button.id.replace("rt-tb-", "");
  button.addEventListener("click", (ev) => {
    ev.preventDefault();
    switch (buttonType) {
      case "bold":
        isBold() ? unsetBold() : setBold();
        break;
      case "italic":
        isItalic() ? unsetItalic() : setItalic();
        break;
      case "striked":
        isStrike() ? unsetStrike() : setStrike();
        break;
      case "link":
        toggleExpander("link");
        RT_TOOLBAR_FORM_LINK.querySelector("#rt-link-url").value = editor.getAttributes('link').href ?? ""
        break;
      case "colour":
        toggleExpander("colour");
        RT_TOOLBAR_FORM_COLOUR.querySelector("#rt-colour-hex").value = editor.getAttributes('textStyle').color ?? ""
        break;
      case "hl":
        toggleExpander("hl");
        RT_TOOLBAR_FORM_HL.querySelector("#rt-hl-hex").value = editor.getAttributes('highlight').color ?? ""
        break;
      case "debug":
        console.debug("[RT]", {
          $type: "internal.bunnylog.entry",
          content: getText(),
          createdAt: new Date().toISOString(),
          facets: documentToFacets(getState(), getText())
        });
        break;
      default:
        console.debug("[RT]", `unknown type ${buttonType}`);
        break;
    }
  })
}
