import type { WorkflowStep } from '@app/shared';
import { StatusBadge } from './StatusBadge';

/** Vertical timeline; the icon per status is drawn in CSS so the text content stays "name status error". */
export function StepList({ steps }: { steps: WorkflowStep[] }) {
  return (
    <ol className="timeline" aria-label="Steps">
      {steps.map((step) => (
        <li key={step.name} className={`timeline__item timeline__item--${step.status}`}>
          <span className="timeline__icon" aria-hidden="true" />
          <div className="timeline__body">
            <div className="timeline__row">
              <span className="timeline__name">{step.name}</span>
              <StatusBadge status={step.status} />
            </div>
            {step.errorMessage && <p className="timeline__error">{step.errorMessage}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
