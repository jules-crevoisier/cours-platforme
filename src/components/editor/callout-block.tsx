"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { CALLOUT_LABELS, CALLOUT_TYPES, calloutTypeFromClass, isCalloutType, type CalloutType } from "@/lib/bookstack-blocks";

/**
 * Encadré BookStack (« callout ») : `<p class="callout info|success|warning|danger">`.
 * Même HTML que BookStack à l'export et au collage (copier une page BookStack garde ses encadrés).
 */
export const createCalloutBlock = createReactBlockSpec(
  {
    type: "callout",
    propSchema: {
      type: { default: "info" as CalloutType, values: CALLOUT_TYPES },
    },
    content: "inline",
  },
  {
    meta: { isolating: false },
    // Avant les règles « p » (paragraphe) et « blockquote » (citation) du schéma par défaut
    runsBefore: ["paragraph", "quote"],
    parse(el) {
      if (el.tagName !== "P" && el.tagName !== "DIV") return undefined;
      const type = calloutTypeFromClass(el.getAttribute("class") ?? "");
      return type ? { type } : undefined;
    },
    render: function CalloutRender({ block, editor, contentRef }) {
      const type = isCalloutType(block.props.type) ? block.props.type : "info";
      return (
        <div className={`callout ${type}`} role="note" aria-label={CALLOUT_LABELS[type]}>
          <div className="callout-text" ref={contentRef} />
          {editor.isEditable && (
            <select
              contentEditable={false}
              className="callout-type"
              aria-label="Type d'encadré"
              value={type}
              onChange={(e) => editor.updateBlock(block, { props: { type: e.target.value as CalloutType } })}
            >
              {CALLOUT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CALLOUT_LABELS[t]}
                </option>
              ))}
            </select>
          )}
        </div>
      );
    },
    toExternalHTML: function CalloutExport({ block, contentRef }) {
      const type = isCalloutType(block.props.type) ? block.props.type : "info";
      return <p className={`callout ${type}`} ref={contentRef} />;
    },
  },
);
