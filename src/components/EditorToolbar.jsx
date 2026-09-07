import { Icon } from './Icons.jsx'

/**
 * The controls above the inputs. Everything here reads the inputs rather than writing them: the
 * form is the only way in, so there is nothing to format, minify or paste over.
 */
export default function EditorToolbar({ view, active, onViewChange, canBrowse, onCopy, onDownload, onCompare }) {
  return (
    <div className="toolbar" role="toolbar" aria-label="Profile tools">
      <button className="btn btn-sm btn-ghost" onClick={onCopy} disabled={!canBrowse} title={`Copy “${active}” to the clipboard`}>
        <Icon.Copy /> Copy
      </button>
      <button
        className="btn btn-sm btn-ghost"
        onClick={onDownload}
        disabled={!onDownload}
        title={`Download “${active}” as .json`}
      >
        <Icon.Download /> Download
      </button>
      {onCompare && (
        <button className="btn btn-sm btn-ghost" onClick={onCompare} title="Compare with another profile">
          <Icon.Compare /> Compare
        </button>
      )}

      <div className="segmented toolbar-views" role="tablist" aria-label="View">
        <button
          role="tab"
          aria-selected={view === 'form'}
          className={view === 'form' ? 'is-active' : ''}
          onClick={() => onViewChange('form')}
          title="Fill in the fields the templates ask for"
        >
          Form
        </button>
        <button
          role="tab"
          aria-selected={view === 'tree'}
          className={view === 'tree' ? 'is-active' : ''}
          onClick={() => onViewChange('tree')}
          disabled={!canBrowse}
          title={canBrowse ? 'Browse the inputs the form has built' : 'Pick a template first — there is nothing to browse yet'}
        >
          Tree
        </button>
      </div>
    </div>
  )
}
