'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { X, Plus, Image, Type, Trash2 } from 'lucide-react';

interface CertificateTemplate {
  id: number;
  name: string;
  background_image: string | null;
  layout_config: any;
}

interface CreateTemplateModalProps {
  template: CertificateTemplate | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface Placeholder {
  id: string;
  label: string;
  x: number;
  y: number;
  // In a real app, you'd add font size, color, etc.
}

export function CreateTemplateModal({ template, onClose, onSuccess }: CreateTemplateModalProps) {
  const [name, setName] = useState('');
  const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setPreviewUrl(template.background_image);
      setPlaceholders(template.layout_config || []);
    }
  }, [template]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setBackgroundImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const addPlaceholder = () => {
    const newId = `field_${placeholders.length + 1}`;
    setPlaceholders([...placeholders, { id: newId, label: 'New Field', x: 50, y: 50 }]);
  };
  
  const updatePlaceholder = (index: number, newLabel: string) => {
    const updated = [...placeholders];
    updated[index].label = newLabel;
    setPlaceholders(updated);
  }

  const removePlaceholder = (index: number) => {
    setPlaceholders(placeholders.filter((_, i) => i !== index));
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      toast.error('Please provide a template name.');
      return;
    }
    if (!backgroundImage && !template) {
      toast.error('Please upload a background image.');
      return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('layout_config', JSON.stringify(placeholders));
    if (backgroundImage) {
      formData.append('background_image', backgroundImage);
    }

    try {
      if (template) {
        await axios.patch(`/api/task/certificate-templates/${template.id}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Template updated successfully');
      } else {
        await axios.post('/api/task/certificate-templates/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Template created successfully');
      }
      onSuccess();
    } catch (error) {
      console.error('Failed to save template:', error);
      toast.error('Failed to save template.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-2xl border border-border w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-surface z-10">
          <h2 className="text-xl font-bold">{template ? 'Edit Template' : 'Create New Template'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-background rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-grow overflow-hidden flex">
          <div className="w-1/3 p-6 border-r border-border overflow-y-auto space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Template Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., Course Completion Certificate"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Background Image</label>
              <input type="file" onChange={handleFileChange} accept="image/*" className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"/>
            </div>

            <hr className="border-border" />

            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold">Placeholders</h4>
                <button type="button" onClick={addPlaceholder} className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-lg flex items-center gap-1 hover:bg-primary/20">
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>
              <div className="space-y-2">
                {placeholders.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Type className="h-4 w-4 text-text-secondary"/>
                    <input
                      type="text"
                      value={p.label}
                      onChange={(e) => updatePlaceholder(i, e.target.value)}
                      className="flex-grow px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button type="button" onClick={() => removePlaceholder(i)} className="p-1.5 text-error/70 hover:text-error hover:bg-error/10 rounded-md">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="w-2/3 p-6 flex items-center justify-center bg-background/50 overflow-auto">
            <div className="relative shadow-lg">
                {previewUrl ? (
                    <img src={previewUrl} alt="Certificate Preview" className="max-w-full max-h-[75vh]" />
                ) : (
                    <div className="w-[800px] h-[565px] bg-gray-200 flex items-center justify-center rounded-lg">
                        <div className="text-center text-gray-500">
                            <Image className="h-16 w-16 mx-auto mb-2" />
                            <p>Upload a background to get started</p>
                        </div>
                    </div>
                )}
                {/* A real implementation would have draggable placeholders here */}
            </div>
          </div>
        </form>
         <div className="p-6 border-t border-border flex justify-end gap-3 sticky bottom-0 bg-surface z-10">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-background border border-border text-text-primary rounded-xl hover:bg-border/50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="template-form"
              onClick={handleSave}
              className="px-6 py-2.5 bg-primary text-background rounded-xl hover:bg-primary/90 transition-colors font-medium"
            >
              {template ? 'Update Template' : 'Save Template'}
            </button>
          </div>
      </div>
    </div>
  );
}