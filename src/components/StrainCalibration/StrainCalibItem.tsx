import { PropsWithRef, useEffect, useRef, useState } from "react";
import "./StrainCalibItem.scss";

interface StrainCalibItemProps
  extends PropsWithRef<JSX.IntrinsicElements["div"]> {
  image: string;
  step: number;
  stepHTML: React.ReactNode;
  stepBtnText?: string;
  automatic?: boolean;
  automaticDuration?: number;
  active: boolean;
  nextStepCallback?: () => void;
}

const StrainCalibItem: React.FC<StrainCalibItemProps> = ({
  image,
  step,
  stepHTML,
  stepBtnText,
  automatic = false,
  automaticDuration = 0,
  active,
  nextStepCallback,
}) => {
  const [countdown, setCountdown] = useState<number>(automaticDuration);
  const active_ref = useRef<HTMLDivElement>(null);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  useEffect(() => {
    if (active_ref.current) {
      active_ref.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
    if (automatic && active) {
      setIsAnimating(true);
      const interval = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : prev));
      }, 1000);
      setCountdown(automaticDuration);
      return () => clearInterval(interval);
    }
    setIsAnimating(false);
    setCountdown(automaticDuration);
  }, [active, automatic, automaticDuration]);
  return (
    <div
      className={`flex w-fit flex-shrink-0 select-none flex-col gap-4 ${!active && "cursor-not-allowed"}`}
      ref={active_ref}
    >
      <div
        className={`relative z-0 inline-block overflow-hidden border-2 border-slate-700 px-4 py-2 sm:px-20 min-h-[200px] sm:min-h-[250px] ${active && "bg-secondary"}`}
      >
        <p
          className="font-82XC absolute left-0 top-0 -z-10 p-2 text-[420px] leading-[0.9]"
          style={{ color: "#C1C6C4" }}
        >
          {step}
        </p>
        <img src={image} alt="" className="select-none" />
        <div className={`font-44ND pb-2 pt-2 text-center text-sm leading-tight text-black sm:pt-4 sm:text-3xl sm:leading-6 ${!active && "invisible"}`}>
          {stepHTML}
        </div>
      </div>
      <button
        className={`btn ${!active && "pointer-events-none opacity-50"} ${isAnimating && `button-fill-animation animate-[fillBackground_${automaticDuration}s_forwards]`}`}
        onClick={() => {
          if (automaticDuration > 0 && !automatic) {
            setIsAnimating(true);
          }
          nextStepCallback?.();
        }}
      >
        {(automatic && countdown + "s") || stepBtnText}
      </button>
    </div>
  );
};

export default StrainCalibItem;
