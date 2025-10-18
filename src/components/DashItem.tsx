import { HTMLAttributes, PropsWithChildren, useEffect, useState } from "react";
import "./DashItem.scss";

interface DashItemProps
  extends PropsWithChildren,
    HTMLAttributes<HTMLDivElement> {
  title: string;
  index: number;
  status?: string;
  saveState?: boolean;
}

const DashItem: React.FC<DashItemProps> = ({
  title,
  index,
  status,
  saveState,
  children,
  className = "",
  ...props
}) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (saveState && localStorage.getItem(title + index) !== null) {
      setOpen(localStorage.getItem(title + index) === "true");
    }
  }, []);
  return (
    <div
      className={`item_container relative ${open ? "active" : ""} ${className}`}
      {...props}
    >
      <header
        onClick={() => {
          saveState && localStorage.setItem(title + index, (!open).toString());
          setOpen(!open);
        }}
      >
        <div>
          <h3>[{index}]</h3>
          <h1>{title}</h1>
        </div>
        <span>{open ? ">" : "<"}</span>
        {status && (
          <p className="absolute left-2 top-1 text-[0.5rem] leading-tight sm:text-xs">
            {status}
          </p>
        )}
      </header>
      <div className="item_inner_container overflow-visible">{children}</div>
    </div>
  );
};

export default DashItem;
