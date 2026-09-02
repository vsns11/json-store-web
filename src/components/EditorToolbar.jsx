import { Icon } from './Icons.jsx'

export default function EditorToolbar({
  view,
  onViewChange,
  canFormat,
  canUseForm,
  onFormat,
  onMinify,
  onSortKeys,
  onCopy,
  onDownload,
  onUpload,
  onSample,
}) {
  return (
    <div className="toolbar">
      <button className="btn btn-sm" onClick={onFormat} disabled={!canFormat} title="Pretty-print (⌘⇧F)">
        <Icon.Wand /> Format
      </button>
      <button className="btn btn-sm" onClick={onMinify} disabled={!canFormat} title="Strip all whitespace">
        <Icon.Compress /> Minify
      </button>
      <button className="btn btn-sm" onClick={onSortKeys} disabled={!canFormat} title="Sort object keys A–Z">
        <Icon.Sort /> Sort keys
      </button>

      <span className="toolbar-divider" />

      <button className="btn btn-sm btn-ghost" onClick={onCopy} title="Copy to clipboard">
        <Icon.Copy /> Copy
      </button>
      <button className="btn btn-sm btn-ghost" onClick={onDownload} disabled={!canFormat} title="Download as .json">
        <Icon.Download /> Download
      </button>
      <button className="btn btn-sm btn-ghost" onClick={onUpload} title="Load a .json file">
        <Icon.Upload /> Import
      </button>
      <button className="btn btn-sm btn-ghost" onClick={onSample} title="Insert a sample payload">
        <Icon.File /> Sample
      </button>

      <span className="toolbar-divider" />

      <div className="segmented" style={{ marginLeft: 'auto' }}>
        {canUseForm && (
          <button
            className={view === 'form' ? 'is-active' : ''}
            onClick={() => onViewChange('form')}
            title="Build the inputs from templates"
          >
            Form
          </button>
        )}
        <button className={view === 'code' ? 'is-active' : ''} onClick={() => onViewChange('code')}>
          Editor
        </button>
        <button className={view === 'tree' ? 'is-active' : ''} onClick={() => onViewChange('tree')} disabled={!canFormat}>
          Tree
        </button>
      </div>
    </div>
  )
}
