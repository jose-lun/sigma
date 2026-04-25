import { useState, useEffect, useRef } from 'react';
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
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

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

export default function Rubric({ user }) {
  const [rubric, setRubric] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visualOrder, setVisualOrder] = useState([]);
  const [form, setForm] = useState({
    name: '',
    type: 'checklist',
    polarity: 'sigma',
    target: '',
    points: ''
  });
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [saved, setSaved] = useState(false);
  const debounceTimeout = useRef(null);
  const sigTotal = 150;
  const ligTotal = -50;

  useEffect(() => {
    if (!user?.uid) return;
    async function loadRubric() {
      try {
        const docRef = doc(db, 'rubrics', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const loaded = docSnap.data().rubric || [];
          const sorted = [...loaded].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          setRubric(sorted);
        }
      } catch (err) {
        console.error("Failed to load rubric:", err);
      } finally {
        setLoading(false);
      }
    }
    loadRubric();
  }, [user]);

  useEffect(() => {
    if (rubric.length > 0) {
      setVisualOrder(rubric.map(h => h.id));
    }
  }, [rubric]);

  const saveRubricWithDebounce = (rubricToSave) => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    debounceTimeout.current = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'rubrics', user.uid), {
          rubric: rubricToSave,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("Failed to save rubric (debounced):", err);
      }
    }, 500);
  };

  const sigmaTotal = rubric
    .filter(h => h.polarity === 'sigma')
    .reduce((sum, h) => sum + (parseFloat(h.points) || 0), 0);

  const ligmaTotal = rubric
    .filter(h => h.polarity === 'ligma')
    .reduce((sum, h) => sum + (parseFloat(h.points) || 0), 0);

  const isValid = sigmaTotal === sigTotal && ligmaTotal === ligTotal;

  const handleAddHabit = () => {
    if (!form.name.trim()) return alert('Please enter a habit name.');
    if (form.points === '' || isNaN(form.points)) return alert('Please enter a valid numeric points value.');

    const parsedPoints = parseFloat(form.points);

    if (form.polarity === 'ligma' && parsedPoints >= 0) {
      return alert('Nabla points must be negative.');
    }

    if (form.polarity === 'sigma' && parsedPoints <= 0) {
      return alert('Delta points must be positive.');
    }

    const newHabit = {
      ...form,
      id: editingIndex ?? crypto.randomUUID(),
      points: parsedPoints,
      target: form.type === 'numeric' ? parseFloat(form.target) : undefined
    };

    const updated = editingIndex !== null
      ? rubric.map(h => h.id === editingIndex ? { ...newHabit, id: editingIndex } : h)
      : [...rubric, { ...newHabit, order: rubric.length }];

    setRubric(updated);

    if (editingIndex === null) {
      setVisualOrder(prev => [...prev, newHabit.id]);
    }

    setEditingIndex(null);
    setForm({ name: '', type: 'checklist', polarity: 'sigma', target: '', points: '' });
  };

  const handleDelete = (habitId) => {
    if (!window.confirm('Delete this habit?')) return;

    const updated = rubric.filter(h => h.id !== habitId);
    setRubric(updated);

    if (editingIndex === habitId) {
      setEditingIndex(null);
      setForm({ name: '', type: 'checklist', polarity: 'sigma', target: '', points: '' });
    }
  };

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  const updateHabitField = (id, field, value) => {
    const updated = rubric.map(h =>
      h.id === id ? { ...h, [field]: value } : h
    );
    setRubric(updated);
  };

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setVisualOrder((prevOrder) => {
      const oldIndex = prevOrder.indexOf(active.id);
      const newIndex = prevOrder.indexOf(over.id);
      const newOrder = arrayMove(prevOrder, oldIndex, newIndex);

      const newRubric = newOrder
        .map((id, index) => {
          const item = rubric.find(h => h.id === id);
          return item ? { ...item, order: index } : null;
        })
        .filter(Boolean);

      setRubric(newRubric);
      saveRubricWithDebounce(newRubric);

      return newOrder;
    });
  }

  async function handleSaveRubric() {
    if (!isValid) return;
    try {
      const cleanedRubric = rubric.map((habit, i) => {
        const cleaned = { ...habit, order: i };
        if (cleaned.target === undefined) delete cleaned.target;
        return cleaned;
      });

      await setDoc(doc(db, 'rubrics', user.uid), {
        rubric: cleanedRubric,
        updatedAt: new Date().toISOString()
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save rubric:", err);
    }
  }

  return (
    <div className="rubric-wrapper">
      <div className="rubric-container">
        <h2>Rubric Builder</h2>

        <div className="rubric-form">
          <label>
            Habit name:
            <input type="text" name="name" value={form.name} onChange={handleChange} />
          </label>
          <label>
            Type:
            <select name="type" value={form.type} onChange={handleChange}>
              <option value="checklist">Checklist</option>
              <option value="numeric">Numeric</option>
            </select>
          </label>
          <label>
            Delta or Nabla?:
            <select name="polarity" value={form.polarity} onChange={handleChange}>
              <option value="sigma">delta</option>
              <option value="ligma">nabla</option>
            </select>
          </label>
          <label>
            Points:
            <input
              type="number"
              name="points"
              value={form.points}
              onChange={handleChange}
              style={{ width: '100px', marginLeft: '8px' }}
            />
          </label>
          {form.type === 'numeric' && (
            <label>
              Target (or max):
              <input type="number" name="target" value={form.target} onChange={handleChange} />
            </label>
          )}
          <button onClick={handleAddHabit}>
            {editingIndex !== null ? 'Update Habit' : 'Add Habit to Rubric'}
          </button>
        </div>

        <div className="habit-header">
          <div className="habit-column name">Name</div>
          <div className="habit-column points">Points</div>
          <div className="habit-column target">Target / Max</div>
        </div>

        <DndContext
          collisionDetection={closestCenter}
          sensors={useSensors(useSensor(PointerSensor))}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={visualOrder} strategy={verticalListSortingStrategy}>
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
                          <div className="habit-fields">
                            {editingField?.id === habit.id && editingField.field === 'name' ? (
                              <input
                                type="text"
                                value={habit.name}
                                onChange={(e) => updateHabitField(habit.id, 'name', e.target.value)}
                                onBlur={() => setEditingField(null)}
                                autoFocus
                                className="habit-input name"
                              />
                            ) : (
                              <strong
                                className="habit-text name"
                                onClick={() => setEditingField({ id: habit.id, field: 'name' })}
                                style={{ cursor: 'pointer' }}
                              >
                                {habit.name}
                              </strong>
                            )}
                            {editingField?.id === habit.id && editingField.field === 'points' ? (
                              <input
                                type="number"
                                value={isNaN(habit.points) ? '' : habit.points}
                                onChange={(e) => updateHabitField(habit.id, 'points', parseFloat(e.target.value))}
                                onBlur={() => setEditingField(null)}
                                autoFocus
                                className="habit-input points"
                              />
                            ) : (
                              <span
                                className="habit-text points"
                                onClick={() => setEditingField({ id: habit.id, field: 'points' })}
                                style={{ cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                {habit.points}
                              </span>
                            )}
                            {habit.type === 'numeric' && (
                              editingField?.id === habit.id && editingField.field === 'target' ? (
                                <input
                                  type="number"
                                  value={isNaN(habit.target) ? '' : habit.target}
                                  onChange={(e) => updateHabitField(habit.id, 'target', parseFloat(e.target.value))}
                                  onBlur={() => setEditingField(null)}
                                  autoFocus
                                  className="habit-input target"
                                />
                              ) : (
                                <span
                                  className="habit-text target"
                                  onClick={() => setEditingField({ id: habit.id, field: 'target' })}
                                  style={{ cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                  {habit.target ?? ''}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                        <div className="habit-buttons">
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

        <div className="rubric-summary">
          <div className="rubric-totals">
            <p>
              Delta Total: <strong style={{ color: sigmaTotal === sigTotal ? "limegreen" : "red" }}>{sigmaTotal}</strong> / {sigTotal.toString()}
            </p>
            <p>
              Nabla Total: <strong style={{ color: ligmaTotal === ligTotal ? "limegreen" : "red" }}>{ligmaTotal}</strong> / {ligTotal.toString()}
            </p>
          </div>

          <div className="save-button-wrapper">
            <button
              onClick={handleSaveRubric}
              disabled={!isValid}
              className={`save-rubric-button ${saved ? 'saved' : ''}`}
            >
              {saved ? "✔ Saved!" : "Save Rubric"}
            </button>
            {!isValid && (
              <div className="tooltip-message">
                Cannot save rubric until points totals are correct
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}