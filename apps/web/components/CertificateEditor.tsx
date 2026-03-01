"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import type { ComponentType, ReactNode } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  Award,
  Calendar,
  Clock3,
  Fingerprint,
  QrCode,
  ShieldCheck,
  Star,
  Type,
  UserSquare2,
  X,
} from "lucide-react";
import { CertificateTemplate, LayoutConfig, LayoutItem } from "@/lib/types";

const ItemTypes = {
  FIELD: "field",
};

const SafeDndProvider = DndProvider as unknown as ComponentType<{
  backend: typeof HTML5Backend;
  children?: ReactNode;
}>;

const PAGE_WIDTH = 842; // A4 Landscape width in points
const PAGE_HEIGHT = 595; // A4 Landscape height in points

// --- Coordinate Conversion Helpers ---

const getItemHeight = (item: LayoutItem, id: string): number => {
  if (id === "qr_code") {
    return item.size || 0;
  }
  // Approximate height based on font size. This is not perfect but a reasonable guess.
  return item.font_size || 0;
};

const toBackendCoordinates = (layout: LayoutConfig): LayoutConfig => {
  const newLayout: LayoutConfig = {};
  for (const id in layout) {
    const item = layout[id];
    const itemHeight = getItemHeight(item, id);
    newLayout[id] = {
      ...item,
      y: PAGE_HEIGHT - item.y - itemHeight,
    };
  }
  return newLayout;
};

const fromBackendCoordinates = (layout: LayoutConfig): LayoutConfig => {
  const newLayout: LayoutConfig = {};
  for (const id in layout) {
    const item = layout[id];
    const itemHeight = getItemHeight(item, id);
    newLayout[id] = {
      ...item,
      y: PAGE_HEIGHT - item.y - itemHeight,
    };
  }
  return newLayout;
};

// --- Draggable Field Component (already placed on canvas) ---

interface DraggableFieldProps {
  id: string;
  item: LayoutItem;
  onSelect: (id: string) => void;
  isSelected: boolean;
}

const DraggableField: React.FC<DraggableFieldProps> = ({
  id,
  item,
  onSelect,
  isSelected,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.FIELD,
    item: { id, type: "existing", x: item.x, y: item.y },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(ref);

  return (
    <div
      ref={ref}
      style={{
        left: item.x,
        top: item.y,
        color: item.color,
        fontSize: item.font_size,
        fontFamily: item.font_name,
        position: "absolute",
        cursor: "move",
        border: isSelected ? "2px dashed #3b82f6" : "1px solid transparent",
        padding: "2px 4px",
        opacity: isDragging ? 0.5 : 1,
        whiteSpace: "nowrap",
        zIndex: isSelected ? 10 : 5,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
    >
      {id === "qr_code" ? <QrCode size={item.size} /> : item.text || id}
    </div>
  );
};

// --- Available Fields (for drag source) ---

const AVAILABLE_FIELDS = [
  { id: "student_name", label: "Student Name", icon: <Type size={18} /> },
  { id: "course_name", label: "Course Name", icon: <Award size={18} /> },
  {
    id: "teacher_name",
    label: "Teacher Name",
    icon: <UserSquare2 size={18} />,
  },
  {
    id: "completion_date",
    label: "Completion Date",
    icon: <Calendar size={18} />,
  },
  {
    id: "issued_date",
    label: "Issued Date",
    icon: <Calendar size={18} />,
  },
  { id: "grade", label: "Grade", icon: <Star size={18} /> },
  { id: "hours", label: "Hours", icon: <Clock3 size={18} /> },
  {
    id: "certificate_id",
    label: "Certificate ID",
    icon: <Fingerprint size={18} />,
  },
  {
    id: "verification_code",
    label: "Verification Code",
    icon: <ShieldCheck size={18} />,
  },
  { id: "qr_code", label: "QR Code", icon: <QrCode size={18} /> },
];

const Field: React.FC<{ id: string; label: string; icon: ReactNode }> = ({
  id,
  label,
  icon,
}) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.FIELD,
    item: { id, type: "new" },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={drag}
      style={{ opacity: isDragging ? 0.5 : 1 }}
      className="p-2 border border-border rounded-lg flex items-center gap-2 cursor-grab bg-background hover:bg-border/50 transition-colors"
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
};

// --- Properties Panel (for selected field) ---

const PropertiesPanel: React.FC<{
  selectedField: string;
  layout: LayoutConfig;
  setLayout: React.Dispatch<React.SetStateAction<LayoutConfig>>;
}> = ({ selectedField, layout, setLayout }) => {
  const fieldData = layout[selectedField];

  const updateLayout = (key: string, value: any) => {
    setLayout((prev) => ({
      ...prev,
      [selectedField]: { ...prev[selectedField], [key]: value },
    }));
  };

  const removeField = () => {
    setLayout((prev) => {
      const newLayout = { ...prev };
      delete newLayout[selectedField];
      return newLayout;
    });
  };

  return (
    <div className="border-t border-border pt-4">
      <h3 className="text-lg font-semibold mb-4 capitalize">
        {selectedField.replace("_", " ")} Properties
      </h3>
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Font Name</label>
          <select
            value={fieldData.font_name}
            onChange={(e) => updateLayout("font_name", e.target.value)}
            className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="Helvetica">Helvetica</option>
            <option value="Helvetica-Bold">Helvetica-Bold</option>
            <option value="Times-Roman">Times-Roman</option>
            <option value="Times-Bold">Times-Bold</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Font Size</label>
          <input
            type="number"
            value={fieldData.font_size}
            onChange={(e) =>
              updateLayout("font_size", parseInt(e.target.value))
            }
            className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Color</label>
          <input
            type="color"
            value={fieldData.color}
            onChange={(e) => updateLayout("color", e.target.value)}
            className="w-full h-10 px-1 py-1 bg-background border border-border rounded-xl cursor-pointer"
          />
        </div>
        {selectedField !== "qr_code" && (
          <div>
            <label className="block text-sm font-medium mb-1">Alignment</label>
            <select
              value={fieldData.align || "left"}
              onChange={(e) => updateLayout("align", e.target.value)}
              className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        )}
        {selectedField === "qr_code" && (
          <div>
            <label className="block text-sm font-medium mb-1">
              QR Size (points)
            </label>
            <input
              type="number"
              value={fieldData.size}
              onChange={(e) => updateLayout("size", parseInt(e.target.value))}
              className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}
        <button
          onClick={removeField}
          className="px-4 py-2 mt-2 bg-error/10 text-error rounded-xl hover:bg-error/20 transition-colors font-medium"
        >
          Remove Field
        </button>
      </div>
    </div>
  );
};

interface CertificateEditorProps {
  template: CertificateTemplate | null;
  onSave: (template: FormData) => void;
  onClose: () => void;
}

// --- Main Certificate Editor Component ---

const CertificateEditor: React.FC<CertificateEditorProps> = ({
  template,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState(template?.name || "");
  const [templateType, setTemplateType] = useState(
    template?.template_type || "standard",
  );
  const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(
    null,
  );
  const [backgroundColor, setBackgroundColor] = useState(
    template?.background_color || "#ffffff",
  );
  const [textColor, setTextColor] = useState(template?.text_color || "#111827");
  const [borderColor, setBorderColor] = useState(
    template?.border_color || "#DAA520",
  );
  const [isActive, setIsActive] = useState(template?.is_active ?? true);
  const [isDefault, setIsDefault] = useState(template?.is_default ?? false);
  const [layout, setLayout] = useState<LayoutConfig>({});
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setTemplateType(template.template_type || "standard");
      setBackgroundColor(template.background_color || "#ffffff");
      setTextColor(template.text_color || "#111827");
      setBorderColor(template.border_color || "#DAA520");
      setIsActive(template.is_active ?? true);
      setIsDefault(template.is_default ?? false);
      // Convert from backend coordinates to frontend coordinates when loading
      setLayout(fromBackendCoordinates(template.layout_config || {}));
      if (typeof template.background_image === "string") {
        setBackgroundImageUrl(template.background_image);
        setBackgroundImage(null);
      } else if (template.background_image_url) {
        setBackgroundImageUrl(template.background_image_url);
        setBackgroundImage(null);
      } else if (template.background_image instanceof File) {
        setBackgroundImage(template.background_image);
        setBackgroundImageUrl(URL.createObjectURL(template.background_image));
      } else {
        setBackgroundImageUrl(null);
        setBackgroundImage(null);
      }
    } else {
      setName("");
      setTemplateType("standard");
      setBackgroundImage(null);
      setBackgroundImageUrl(null);
      setBackgroundColor("#ffffff");
      setTextColor("#111827");
      setBorderColor("#DAA520");
      setIsActive(true);
      setIsDefault(false);
      setLayout({});
      setSelectedField(null);
    }
  }, [template]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setBackgroundImage(file);
      setBackgroundImageUrl(URL.createObjectURL(file));
    }
  };

  const handleSave = () => {
    const formData = new FormData();
    if (template?.id) {
      formData.append("id", String(template.id));
    }
    formData.append("name", name);
    formData.append("template_type", templateType);
    formData.append("background_color", backgroundColor);
    formData.append("text_color", textColor);
    formData.append("border_color", borderColor);
    formData.append("is_active", String(isActive));
    formData.append("is_default", String(isDefault));

    // Convert from frontend coordinates to backend coordinates before saving
    const backendLayout = toBackendCoordinates(layout);
    formData.append("layout_config", JSON.stringify(backendLayout));

    if (backgroundImage) {
      formData.append("background_image", backgroundImage);
    }

    onSave(formData);
  };
  const moveField = useCallback((id: string, x: number, y: number) => {
    setLayout((prev) => ({
      ...prev,
      [id]: { ...prev[id], x, y },
    }));
  }, []);

  const addNewField = useCallback(
    (id: string, x: number, y: number) => {
      setLayout((prev) => ({
        ...prev,
        [id]: {
          x,
          y,
          font_name: "Helvetica",
          font_size: 24,
          color: textColor,
          text: AVAILABLE_FIELDS.find((f) => f.id === id)?.label,
          align: "left",
          ...(id === "qr_code" && { size: 100 }),
        },
      }));
    },
    [textColor],
  );

  const [, drop] = useDrop({
    accept: ItemTypes.FIELD,
    drop: (
      item: { id: string; type: string; x?: number; y?: number },
      monitor,
    ) => {
      if (!canvasRef.current) return;

      const delta = monitor.getDifferenceFromInitialOffset();
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const clientOffset = monitor.getClientOffset();

      if (!delta || !clientOffset) return;

      let x: number, y: number;

      if (item.type === "existing") {
        // For existing items, calculate new absolute position
        x = item.x! + delta.x;
        y = item.y! + delta.y;
      } else {
        // For new items, calculate position relative to canvas
        x = clientOffset.x - canvasRect.left + canvasRef.current.scrollLeft;
        y = clientOffset.y - canvasRect.top + canvasRef.current.scrollTop;
      }

      // Clamp position to be within canvas bounds
      x = Math.max(0, Math.min(x, PAGE_WIDTH - 50));
      y = Math.max(0, Math.min(y, PAGE_HEIGHT - 20));

      if (item.type === "existing") {
        moveField(item.id, x, y);
      } else {
        addNewField(item.id, x, y);
      }
    },
  });

  drop(canvasRef);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl border border-border w-full h-full max-w-7xl flex flex-col">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-2xl font-bold">Certificate Template Editor</h2>
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-background border border-border rounded-xl hover:bg-border/50 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-primary text-background rounded-xl hover:bg-primary/90 font-medium"
            >
              Save Template
            </button>
          </div>
        </div>

        <div className="flex-grow flex flex-row min-h-0">
          {/* Left Panel */}
          <div className="w-1/4 min-w-[300px] border-r border-border p-6 flex flex-col gap-6 overflow-y-auto">
            <div>
              <label className="block text-sm font-medium mb-2">
                Template Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., Official Course Certificate"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Template Type
              </label>
              <select
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value)}
                className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="standard">Standard Certificate</option>
                <option value="honors">Certificate with Honors</option>
                <option value="completion">Certificate of Completion</option>
                <option value="achievement">Certificate of Achievement</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Background
                </label>
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-full h-10 px-1 py-1 bg-background border border-border rounded-xl cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Text</label>
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-full h-10 px-1 py-1 bg-background border border-border rounded-xl cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Border</label>
                <input
                  type="color"
                  value={borderColor}
                  onChange={(e) => setBorderColor(e.target.value)}
                  className="w-full h-10 px-1 py-1 bg-background border border-border rounded-xl cursor-pointer"
                />
              </div>
            </div>
            <div className="space-y-3 rounded-xl border border-border p-4">
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Active template</span>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Set as default</span>
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Background Image
              </label>
              <input
                type="file"
                onChange={handleFileChange}
                accept="image/png, image/jpeg"
                className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
              {backgroundImageUrl && (
                <div className="mt-2 relative">
                  <img
                    src={backgroundImageUrl}
                    alt="Background Preview"
                    className="max-w-full h-auto rounded-lg"
                  />
                  <button
                    onClick={() => {
                      setBackgroundImage(null);
                      setBackgroundImageUrl(null);
                    }}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full text-xs"
                    title="Remove background image"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
            <div className="flex-grow">
              <h3 className="text-lg font-semibold mb-4">Available Fields</h3>
              <p className="text-sm text-text-secondary mb-4">
                Drag dynamic placeholders into the canvas to control final PDF
                placement.
              </p>
              <div className="flex flex-col gap-2">
                {AVAILABLE_FIELDS.map(
                  (field) =>
                    !layout[field.id] && <Field key={field.id} {...field} />,
                )}
              </div>
              {selectedField && layout[selectedField] && (
                <PropertiesPanel
                  selectedField={selectedField}
                  layout={layout}
                  setLayout={setLayout}
                />
              )}
            </div>
          </div>

          {/* Right Panel (Canvas) */}
          <div className="flex-grow p-6 overflow-auto bg-gray-100">
            <div
              ref={canvasRef}
              className="relative bg-white shadow-lg mx-auto"
              style={{
                width: PAGE_WIDTH,
                height: PAGE_HEIGHT,
                backgroundColor,
                backgroundImage: backgroundImageUrl
                  ? `url(${backgroundImageUrl})`
                  : "none",
                backgroundSize: "100% 100%",
                backgroundRepeat: "no-repeat",
                border: `3px solid ${borderColor}`,
              }}
              onClick={() => setSelectedField(null)}
            >
              {Object.entries(layout).map(([id, item]) => (
                <DraggableField
                  key={id}
                  id={id}
                  item={item}
                  onSelect={setSelectedField}
                  isSelected={selectedField === id}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Wrap with DndProvider for use
function CertificateEditorWrapper(props: CertificateEditorProps) {
  return (
    <SafeDndProvider backend={HTML5Backend}>
      <CertificateEditor {...props} />
    </SafeDndProvider>
  );
}

export default CertificateEditorWrapper;
