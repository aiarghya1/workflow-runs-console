import type { WorkflowStep } from '@app/shared';
import { StatusBadge } from './StatusBadge';

export function StepList({ steps }: { steps: WorkflowStep[] }) {
  return (
    <ol className="steps" aria-label="Steps">
      {steps.map((step) => (
        <li key={step.name} className={`step step--${step.status}`}>
          <span className="step__name">{step.name}</span>
          <StatusBadge status={step.status} />
          {step.errorMessage && <p className="step__error">{step.errorMessage}</p>}
        </li>
      ))}
    </ol>
  );
}
