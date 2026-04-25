import { useState, useEffect } from 'react';

import {
    DndContext,
    closestCenter,
    useSensor,
    useSensors,
    PointerSensor
  } from '@dnd-kit/core';
  
import {
    arrayMove,
    SortableContext,
    useSortable,
    verticalListSortingStrategy
  } from '@dnd-kit/sortable';
  
import { CSS } from '@dnd-kit/utilities';

import './Rubric.css';

function calculateRubricPoints(rubric) {
  const sigma = rubric.filter(h => h.polarity === 'sigma');
  const ligma = rubric.filter(h => h.polarity === 'ligma');

  const sigmaTotal = sigma.reduce((sum, h) => sum + h.importance, 0) || 1;
  const ligmaTotal = ligma.reduce((sum, h) => sum + h.importance, 0) || 1;

  return rubric.map(habit => {
    const base = habit.polarity === 'sigma'
      ? (habit.importance / sigmaTotal) * 100
      : (habit.importance / ligmaTotal) * -50;

    return { ...habit, points: Math.round(base) };
  });
}


  
function SortableItem({ id, polarity, children }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      listStyle: 'none',
      padding: 0,
      border: '1px solid #aaa',
      margin: 0,
      borderRadius: '4px',
      background: polarity === 'sigma' ? '#d2f8d2' : '#f8d2d2',
    };
  
    return (
      <li ref={setNodeRef} style={style} {...attributes}>
        {children(listeners)}
      </li>
    );
}

export default function Rubric() {
  const [rubric, setRubric] = useState(() => {
    const saved = localStorage.getItem('rubric');
    return saved ? JSON.parse(saved) : [];
  });

  const [form, setForm] = useState({
    name: '',
    type: 'checklist',
    polarity: 'sigma',
    importance: 5,
    target: ''
  });

  const [editingIndex, setEditingIndex] = useState(null);

  const [visualOrder, setVisualOrder] = useState(() =>
    rubric.map(h => h.id)
  );

  useEffect(() => {
    setVisualOrder(rubric.map(h => h.id));
  }, [rubric]);
  
  // Save to localStorage whenever rubric changes
  useEffect(() => {
    localStorage.setItem('rubric', JSON.stringify(rubric));
  }, [rubric]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };
  

  const handleAddHabit = () => {
    if (!form.name.trim()) return alert('Please enter a habit name.');
  
    const newHabit = {
      ...form,
      id: editingIndex ?? crypto.randomUUID(),
      importance: parseInt(form.importance),
      target: form.type === 'numeric' ? parseFloat(form.target) : undefined
    };
  
    const updated = editingIndex !== null
      ? rubric.map(h =>
          h.id === editingIndex ? { ...newHabit, id: editingIndex } : h
        )
      : [...rubric, newHabit];
  
    setRubric(calculateRubricPoints(updated));
    setEditingIndex(null);
  
    setForm({
      name: '',
      type: 'checklist',
      polarity: 'sigma',
      importance: 5,
      target: ''
    });
  };
  
  

  const handleDelete = (idToDelete) => {
    if (window.confirm('Delete this habit?')) {
      const updated = rubric.filter(h => h.id !== idToDelete);
      setRubric(calculateRubricPoints(updated)); // Recalculate points
      setVisualOrder(prev => prev.filter(id => id !== idToDelete));
      if (editingIndex === idToDelete) {
        setForm({ name: '', type: 'checklist', polarity: 'sigma', importance: 5, target: '' }); // Reset form
        setEditingIndex(null); // Exit editing mode if deleting the current edit
      }
    }
  }

  const handleEdit = (idToEdit) => {
    const habit = rubric.find(h => h.id === idToEdit);
    if (!habit) return;
    setForm({
      name: habit.name,
      type: habit.type,
      polarity: habit.polarity,
      importance: habit.importance,
      target: habit.target || ''
    });
    setEditingIndex(idToEdit);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
  
    // 1. Update visualOrder
    setVisualOrder((prevOrder) => {
      const oldIndex = prevOrder.indexOf(active.id);
      const newIndex = prevOrder.indexOf(over.id);
      const newOrder = arrayMove(prevOrder, oldIndex, newIndex);
  
      // 2. Reorder rubric to match new visual order
      const newRubric = newOrder
        .map(id => rubric.find(h => h.id === id))
        .filter(Boolean); // in case of any deleted/undefined refs
  
      setRubric(calculateRubricPoints(newRubric)); // 👈 also reassign points after reordering
      return newOrder; // return updated visualOrder too
    });
  }
  
  // Render the form and rubric

  return (
    <div className="rubric-wrapper">
    <div className="rubric-container">
      <h2>Rubric Builder</h2>

    <div className="rubric-form">
      <label>
        Habit name:
        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
        />
      </label>

      <label>
        Type:
        <select name="type" value={form.type} onChange={handleChange}>
          <option value="checklist">Checklist</option>
          <option value="numeric">Numeric</option>
        </select>
      </label>

      <label>
        Sigma or Ligma?:
        <select name="polarity" value={form.polarity} onChange={handleChange}>
          <option value="sigma">sigma</option>
          <option value="ligma">ligma</option>
        </select>
      </label>

      <div className="importance-field">
        <label htmlFor="importance">Importance:</label>
        <input
            id="importance"
            type="range"
            name="importance"
            min="1"
            max="10"
            value={form.importance}
            onChange={handleChange}
        />
        <span className="importance-value">{form.importance}</span>
      </div>

      {form.type === 'numeric' && (
        <label>
          Target (or max):
          <input
            type="number"
            name="target"
            value={form.target}
            onChange={handleChange}
          />
        </label>
      )}

      <button onClick={handleAddHabit}>
        {editingIndex !== null ? 'Update Habit' : 'Add Habit to Rubric'}
      </button>
      </div>

      <h3>Current Rubric</h3>

      <DndContext
        collisionDetection={closestCenter}
        sensors={useSensors(useSensor(PointerSensor))}
        onDragEnd={handleDragEnd}
        >
        <SortableContext
            items={visualOrder}
            strategy={verticalListSortingStrategy}
        >
            <ul style={{ listStyle: 'none', padding: 0 }}>
                {visualOrder.map(id => {
                    const habit = rubric.find(h => h.id === id);
                    if (!habit) return null;

                    return (
                    <SortableItem key={id} id={id} polarity={habit.polarity}>
                        {(listeners) => (
                        <div className={`habit-card ${habit.polarity === 'ligma' ? 'ligma' : ''}`}>
                            <div className="habit-content">
                                <span {...listeners} style={{ cursor: 'grab', fontSize: '20px' }}>⋮</span>
                                <div className="habit-grid">
                                    <div className="habit-name">{habit.name}</div>
                                    <div className="habit-points">{habit.points} pts</div>
                                    <div className="habit-target">
                                        {habit.target ? `${habit.polarity === 'ligma' ? 'Max: ' : 'Target: '}${habit.target}` : ''}
                                    </div>
                                </div>
                            </div>

                            <div className="habit-buttons">
                                <button type="button" onClick={() => handleEdit(habit.id)}>Edit</button>
                                <button type="button" onClick={() => handleDelete(habit.id)}>Delete</button>
                            </div>
                        </div>
                        )}
                    </SortableItem>
                    );
                })}
            </ul>
        </SortableContext>
    </DndContext>

    </div>
    </div>
  );
}
