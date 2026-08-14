import { AlignLeft, LayoutTemplate, Palette } from 'lucide-react'
import {
  COLOR_THEMES,
  PRESENTATION_TEMPLATES,
  TEXT_DENSITIES,
  normalizePreferences
} from '../config/presentationOptions.js'

function ChoiceGroup({ legend, icon: Icon, options, value, onChange, renderSwatch }) {
  return (
    <fieldset className="preference-group">
      <legend>
        <Icon size={16} />
        {legend}
      </legend>
      <div className="preference-options">
        {Object.values(options).map(option => (
          <label
            key={option.id}
            className={`preference-option ${value === option.id ? 'selected' : ''}`}
          >
            <input
              type="radio"
              name={legend}
              value={option.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
            />
            {renderSwatch?.(option)}
            <span>
              <strong>{option.label}</strong>
              {option.description && <small>{option.description}</small>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export default function PresentationOptions({ value, onChange, compact = false }) {
  const preferences = normalizePreferences(value)
  const update = (key, nextValue) => onChange({ ...preferences, [key]: nextValue })

  return (
    <section className={`presentation-options card ${compact ? 'compact' : ''}`}>
      <div className="presentation-options-heading">
        <div>
          <h3>Presentation style</h3>
          <p>These choices control AI content, the preview, and the exported PowerPoint.</p>
        </div>
      </div>

      <div className="presentation-options-grid">
        <ChoiceGroup
          legend="Text per slide"
          icon={AlignLeft}
          options={TEXT_DENSITIES}
          value={preferences.textDensity}
          onChange={next => update('textDensity', next)}
        />
        <ChoiceGroup
          legend="Template"
          icon={LayoutTemplate}
          options={PRESENTATION_TEMPLATES}
          value={preferences.template}
          onChange={next => update('template', next)}
        />
        <ChoiceGroup
          legend="Colour theme"
          icon={Palette}
          options={COLOR_THEMES}
          value={preferences.colorTheme}
          onChange={next => update('colorTheme', next)}
          renderSwatch={theme => (
            <span
              className="theme-swatch"
              style={{ background: `linear-gradient(135deg, #${theme.background} 50%, #${theme.accent} 50%)` }}
              aria-hidden="true"
            />
          )}
        />
      </div>
    </section>
  )
}
