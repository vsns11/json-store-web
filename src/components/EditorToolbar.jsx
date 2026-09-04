import { Icon } from './Icons.jsx'
import { shortcut } from '../lib/platform.js'

export default function EditorToolbar({
  view,
  onViewChange,
  canFormat,
  onFormat,
  onMinify,
  onSortKeys,
  onCopy,
  onDownload,
  onUpload,
  onSample,
  onCompare,
}) {
  const editing = view !== 'form'

  return (
    <div className="toolbar" role="toolbar" aria-label="Editor tools">
      <button className="btn btn-sm" onClick={onFormat} disabled={!canFormat} title={`Pretty-print (${shortcut('⇧', 'F')})`}>
        <Icon.Wand /> Format
      </button>
      <button className="btn btn-sm" onClick={onMinify} disabled={!canFormat} title="Strip all whitespace">
        <Icon.Compress /> Minify
      </button>
      <button className="btn btn-sm" onClick={onSortKeys} disabled={!canFormat} title="Sort object keys A–Z">
        <Icon.Sort /> Sort keys
      </button>

      <span className="toolbar-divider" />

      <button className="btn btn-sm btn-ghost" onClick={onCopy} title="Copy this document to the clipboard">
        <Icon.Copy /> Copy
      </button>
      <button className="btn btn-sm btn-ghost" onClick={onDownload} disabled={!canFormat} title="Download this document as .json">
        <Icon.Download /> Download
      </button>
      <button className="btn btn-sm btn-ghost" onClick={onUpload} title="Load a .json file into this document">
        <Icon.Upload /> Import
      </button>
      <button className="btn btn-sm btn-ghost" onClick={onSample} title="Replace this document with a sample">
        <Icon.File /> Sample
      </button>
      {onCompare && (
        <button className="btn btn-sm btn-ghost" onClick={onCompare} title="Compare with another profile">
          <Icon.Compare /> Compare
        </button>
      )}

      <span className="toolbar-divider" />

      <div className="segmented toolbar-views" role="tablist" aria-label="View">
        <button
          role="tab"
          aria-selected={view === 'form'}
          className={view === 'form' ? 'is-active' : ''}
          onClick={() => onViewChange('form')}
          title="Build the inputs from templates"
        >
          Form
        </button>
        <button
          role="tab"
          aria-selected={view === 'code'}
          className={view === 'code' ? 'is-active' : ''}
          onClick={() => onViewChange('code')}
          title="Edit the JSON by hand"
        >
          Editor
        </button>
        <button
          role="tab"
          aria-selected={view === 'tree'}
          className={view === 'tree' ? 'is-active' : ''}
          onClick={() => onViewChange('tree')}
          disabled={!canFormat}
          title={canFormat ? 'Browse the JSON as a tree' : editing ? 'Fix the JSON first' : 'Browse the JSON as a tree'}
        >
          Tree
        </button>
      </div>
    </div>
  )
}
