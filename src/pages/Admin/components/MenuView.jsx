import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { ChevronLeft, ChevronRight, Edit3, Save, X, Copy } from 'lucide-react';

// Helper to get Monday of a given date's week
const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};

// Format date to YYYY-MM-DD for SQL
const formatDate = (date) => {
  const d = new Date(date);
  const month = '' + (d.getMonth() + 1);
  const day = '' + d.getDate();
  const year = d.getFullYear();
  return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
};

// Add days to a date
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const MEALS = ['breakfast', 'lunch', 'dinner'];

const MenuView = ({ triggerToast }) => {
  const [currentMonday, setCurrentMonday] = useState(getMonday(new Date()));
  const [foodType, setFoodType] = useState('regular'); // 'regular' or 'jain'
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Data structure: { "YYYY-MM-DD_mealType": { id: 123, menu_items: "Poha, Tea..." } }
  const [menuData, setMenuData] = useState({});
  const [draftData, setDraftData] = useState({});

  // Generate the 14 days based on current Monday
  const days = Array.from({ length: 14 }).map((_, i) => addDays(currentMonday, i));
  const week1 = days.slice(0, 7);
  const week2 = days.slice(7, 14);

  const fetchMenuData = async () => {
    setIsLoading(true);
    const startDate = formatDate(days[0]);
    const endDate = formatDate(days[13]);

    try {
      const { data, error } = await supabase
        .from('weekly_menu')
        .select('*')
        .eq('food_type', foodType)
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) throw error;

      const mappedData = {};
      data.forEach(item => {
        const key = `${item.date}_${item.meal_type}`;
        mappedData[key] = { id: item.id, menu_items: item.menu_items };
      });
      
      setMenuData(mappedData);
      setDraftData(mappedData);
    } catch (error) {
      console.error('Error fetching menu:', error);
      triggerToast('error', 'Failed to load menu data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuData();
    setIsEditing(false); // Reset editing mode when changing dates or food type
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonday, foodType]);

  const handleDraftChange = (dateStr, mealType, value) => {
    const key = `${dateStr}_${mealType}`;
    setDraftData(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        menu_items: value
      }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const updateOrDeletePromises = [];
    const inserts = [];

    days.forEach(day => {
      const dateStr = formatDate(day);
      MEALS.forEach(mealType => {
        const key = `${dateStr}_${mealType}`;
        const draftItem = draftData[key] || {};
        const originalItem = menuData[key] || {};

        const textValue = draftItem.menu_items?.trim() || '';
        const originalText = originalItem.menu_items?.trim() || '';

        // Check if this cell already has an entry in the database (it has an ID)
        if (draftItem.id) {
          // Only perform a DB action if the text actually changed
          if (textValue !== originalText) {
            if (textValue === '') {
              // If the admin cleared the cell completely, delete the record
              updateOrDeletePromises.push(
                supabase.from('weekly_menu').delete().eq('id', draftItem.id)
              );
            } else {
              // If text changed, update it via ID
              updateOrDeletePromises.push(
                supabase.from('weekly_menu')
                  .update({ menu_items: textValue })
                  .eq('id', draftItem.id)
              );
            }
          }
        } else {
          // No ID means it's a brand new entry. Only insert if they typed something.
          if (textValue !== '') {
            inserts.push({
              date: dateStr,
              meal_type: mealType,
              food_type: foodType,
              menu_items: textValue
            });
          }
        }
      });
    });

    try {
      // 1. Run all Updates and Deletes in parallel
      if (updateOrDeletePromises.length > 0) {
        // Promise.all waits for all the updates to finish
        const results = await Promise.all(updateOrDeletePromises);
        // Check if any of the promises returned an error
        results.forEach(({ error }) => { if (error) throw error; });
      }
      
      // 2. Run Batch Insert for all new cells
      if (inserts.length > 0) {
        const { error } = await supabase.from('weekly_menu').insert(inserts);
        if (error) throw error;
      }

      triggerToast('success', 'Menu updated successfully!');
      setIsEditing(false);
      fetchMenuData(); // Refresh data to get the new IDs
      
    } catch (error) {
      console.error('Error saving menu:', error);
      triggerToast('error', error.message || 'Failed to save menu updates.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyPrevious = async () => {
    setIsLoading(true);
    // Calculate the date range for the previous 14 days
    const prevStartStr = formatDate(addDays(days[0], -14));
    const prevEndStr = formatDate(addDays(days[13], -14));

    try {
      const { data, error } = await supabase
        .from('weekly_menu')
        .select('*')
        .eq('food_type', foodType)
        .gte('date', prevStartStr)
        .lte('date', prevEndStr);

      if (error) throw error;

      const newDraft = { ...draftData };
      
      data.forEach(item => {
        // Safely parse the SQL date string and shift it forward 14 days
        const [y, m, d] = item.date.split('-');
        const originalDateObj = new Date(y, m - 1, d); 
        const futureDateStr = formatDate(addDays(originalDateObj, 14));
        
        const key = `${futureDateStr}_${item.meal_type}`;

        // Only overwrite the cell if it doesn't already have an existing saved entry in the DB
        if (!menuData[key]?.id) {
          newDraft[key] = {
            ...newDraft[key],
            menu_items: item.menu_items
          };
        }
      });

      setDraftData(newDraft);
      triggerToast('success', 'Imported previous 14-day menu!');
    } catch (error) {
      console.error('Copy error:', error);
      triggerToast('error', 'Failed to copy previous menu.');
    } finally {
      setIsLoading(false);
    }
  };


  const handleCancel = () => {
    setDraftData(menuData);
    setIsEditing(false);
  };

  const navigateWeeks = (weeks) => {
    if (isEditing) {
      const confirmLeave = window.confirm("You have unsaved changes. Discard them?");
      if (!confirmLeave) return;
    }
    setCurrentMonday(addDays(currentMonday, weeks * 7));
  };

  // Render a 7-day table
  const renderWeekTable = (weekDays, title) => (
    <div className="admin-table-wrapper" style={{ marginBottom: '30px' }}>
      <div className="admin-table-header" style={{ background: 'var(--bg-card)' }}>
        <h3>{title}</h3>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: '120px' }}>Date</th>
              {MEALS.map(meal => <th key={meal}>{meal}</th>)}
            </tr>
          </thead>
          <tbody>
            {weekDays.map(day => {
              const dateStr = formatDate(day);
              const dayName = day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              
              return (
                <tr key={dateStr}>
                  <td style={{ fontWeight: 600 }}>{dayName}</td>
                  {MEALS.map(meal => {
                    const key = `${dateStr}_${meal}`;
                    const value = isEditing ? (draftData[key]?.menu_items || '') : (menuData[key]?.menu_items || '—');

                    return (
                      <td key={meal}>
                        {isEditing ? (
                          <textarea
                            className="form-input"
                            style={{ width: '100%', minHeight: '60px', resize: 'vertical', fontSize: '0.85rem' }}
                            value={value}
                            onChange={(e) => handleDraftChange(dateStr, meal, e.target.value)}
                            placeholder={`Enter ${meal} menu...`}
                          />
                        ) : (
                          <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: value === '—' ? 'var(--text-muted)' : 'inherit' }}>
                            {value}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="menu-view">
      {/* Top Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Navigation & Date Range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="icon-btn" onClick={() => navigateWeeks(-2)} title="Previous 2 Weeks">
            <ChevronLeft size={18} />
          </button>
          <div style={{ fontWeight: 700, color: 'var(--text-main)', minWidth: '220px', textAlign: 'center' }}>
            {days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {days[13].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
          <button className="icon-btn" onClick={() => navigateWeeks(2)} title="Next 2 Weeks">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Filters and Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <select 
            className="admin-filter-select"
            value={foodType}
            onChange={(e) => setFoodType(e.target.value)}
            disabled={isEditing}
          >
            <option value="regular">Regular Menu</option>
            <option value="jain">Jain Menu</option>
          </select>

          {!isEditing ? (
            <button className="btn-primary" onClick={() => setIsEditing(true)}>
              <Edit3 size={16} /> Edit Menu
            </button>
          ) : (
            <>
              {/* NEW COPY BUTTON */}
              <button className="btn-ghost" onClick={handleCopyPrevious} disabled={isSaving || isLoading} title="Auto-fill with previous 14 days">
                <Copy size={16} /> Copy Previous 14 Days
              </button>
              
              <button className="btn-ghost" onClick={handleCancel} disabled={isSaving}>
                <X size={16} /> Cancel
              </button>
              <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <span className="spin">↻</span> : <Save size={16} />} 
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="admin-loading">
          <span className="spin">↻</span> Loading menu data...
        </div>
      ) : (
        <>
          {renderWeekTable(week1, 'Week 1')}
          {renderWeekTable(week2, 'Week 2')}
        </>
      )}
    </div>
  );
};

export default MenuView;