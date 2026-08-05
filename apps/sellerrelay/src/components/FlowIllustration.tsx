import { Box, ClipboardCheck, Factory, Truck } from "lucide-react";

export function FlowIllustration({ labels }: { labels: string[] }) {
  const Icon = [Factory, Box, ClipboardCheck, Truck];
  return (
    <div className="flow-illustration" aria-label={labels.join(" to ")}>
      <div className="flow-glow flow-glow-one" />
      <div className="flow-glow flow-glow-two" />
      <div className="warehouse-scene" aria-hidden="true">
        <div className="warehouse-roof" />
        <div className="warehouse-wall">
          <span className="warehouse-door" />
          <span className="warehouse-window" />
          <span className="warehouse-window second" />
        </div>
        <div className="scene-box box-one" />
        <div className="scene-box box-two" />
        <div className="scene-label">SR</div>
        <div className="scanner-line" />
      </div>
      <div className="flow-steps">
        {labels.map((label, index) => {
          const CurrentIcon = Icon[index];
          return (
            <div className="flow-step" key={label}>
              <span className="flow-icon"><CurrentIcon aria-hidden="true" /></span>
              <span>{label}</span>
              {index < labels.length - 1 && <span className="flow-arrow" aria-hidden="true">→</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
