import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { ChevronLeft, ChevronRight, Edit3, Save, X, Copy, Upload } from 'lucide-react';
import { useMenuParse } from '../../../context/MenuParseContext'; // <-- NEW IMPORT

// Helper to get Monday of a given date's week
const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};

const formatDate = (date) => {
  const d = new Date(date);
  const month = '' + (d.getMonth() + 1);
  const day = '' + d.getDate();
  const year = d.getFullYear();
  return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const MEALS = ['breakfast', 'lunch', 'dinner'];

const MenuView = ({ triggerToast }) => {
  // Pull background parsing tools from our new Context
  const { isParsing, parsedRawData, startParsing, clearParsedData } = useMenuParse();
  const fileInputRef = useRef(null);

  const [currentMonday, setCurrentMonday] = useState(getMonday(new Date()));
  const [foodType, setFoodType] = useState('regular'); 
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [menuData, setMenuData] = useState({});

  // NEW: Initialize Draft and Edit states from LocalStorage so they survive reloads
  const [isEditing, setIsEditing] = useState(() => {
    return localStorage.getItem('menu_isEditing') === 'true';
  });
  
  const [draftData, setDraftData] = useState(() => {
    const saved = localStorage.getItem('menu_draftData');
    return saved ? JSON.parse(saved) : {};
  });

  // NEW: Auto-save draft changes to browser memory
  useEffect(() => {
    localStorage.setItem('menu_isEditing', isEditing);
    if (isEditing) {
      localStorage.setItem('menu_draftData', JSON.stringify(draftData));
    } else {
      localStorage.removeItem('menu_draftData');
    }
  }, [isEditing, draftData]);

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
      
      // ONLY overwrite draft if the user isn't currently in the middle of editing
      if (!isEditing) {
        setDraftData(mappedData);
      }
    } catch (error) {
      triggerToast('error', 'Failed to load menu data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonday, foodType]);

  // NEW: Listen for background parsing completion
  useEffect(() => {
    if (parsedRawData && days.length > 0) {
      applyParsedDataToDraft(parsedRawData);
      clearParsedData(); // Clear it from memory so we don't apply it twice
    }
  }, [parsedRawData, days]);

  const handleDraftChange = (dateStr, mealType, value) => {
    const key = `${dateStr}_${mealType}`;
    setDraftData(prev => ({
      ...prev,
      [key]: { ...prev[key], menu_items: value }
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

        if (draftItem.id) {
          if (textValue !== originalText) {
            if (textValue === '') {
              updateOrDeletePromises.push(supabase.from('weekly_menu').delete().eq('id', draftItem.id));
            } else {
              updateOrDeletePromises.push(supabase.from('weekly_menu').update({ menu_items: textValue }).eq('id', draftItem.id));
            }
          }
        } else {
          if (textValue !== '') {
            inserts.push({ date: dateStr, meal_type: mealType, food_type: foodType, menu_items: textValue });
          }
        }
      });
    });

    try {
      if (updateOrDeletePromises.length > 0) await Promise.all(updateOrDeletePromises);
      if (inserts.length > 0) await supabase.from('weekly_menu').insert(inserts);

      triggerToast('success', 'Menu updated successfully!');
      setIsEditing(false); // This automatically wipes the localStorage draft via the useEffect
      fetchMenuData(); 
      
    } catch (error) {
      triggerToast('error', 'Failed to save menu updates.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyPrevious = async () => {
    setIsLoading(true);
    const prevStartStr = formatDate(addDays(days[0], -14));
    const prevEndStr = formatDate(addDays(days[13], -14));

    try {
      const { data, error } = await supabase.from('weekly_menu').select('*').eq('food_type', foodType).gte('date', prevStartStr).lte('date', prevEndStr);
      if (error) throw error;

      setDraftData(prevDraft => {
        const newDraft = { ...prevDraft };
        data.forEach(item => {
          const [y, m, d] = item.date.split('-');
          const futureDateStr = formatDate(addDays(new Date(y, m - 1, d), 14));
          const key = `${futureDateStr}_${item.meal_type}`;
          if (!menuData[key]?.id) newDraft[key] = { ...newDraft[key], menu_items: item.menu_items };
        });
        return newDraft;
      });
      triggerToast('success', 'Imported previous 14-day menu!');
    } catch (error) {
      triggerToast('error', 'Failed to copy previous menu.');
    } finally {
      setIsLoading(false);
    }
  };

  // NEW: Updated to handle the strict { week1: [], week2: [] } JSON format
  // NEW: Robust mapping logic that safely merges both weeks
  const applyParsedDataToDraft = (parsedData) => {
    setDraftData(prevDraft => {
      // Start with a clean copy of the current draft
      const mergedDraft = { ...prevDraft };

      // Helper function that strictly mutates the mergedDraft object
      const applyWeek = (aiWeekArray, targetUiWeekArray) => {
        if (!Array.isArray(aiWeekArray)) return;
        
        aiWeekArray.forEach(row => {
          // Find the matching Date object in our UI's current week view
          const targetDayDate = targetUiWeekArray.find(d => 
            d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() === row.day?.toLowerCase()
          );

          if (targetDayDate) {
            const dateStr = formatDate(targetDayDate);
            
            // Safely merge the new AI text with whatever might already be in that cell
            if (row.breakfast) {
              mergedDraft[`${dateStr}_breakfast`] = { 
                ...mergedDraft[`${dateStr}_breakfast`], 
                menu_items: row.breakfast 
              };
            }
            if (row.lunch) {
              mergedDraft[`${dateStr}_lunch`] = { 
                ...mergedDraft[`${dateStr}_lunch`], 
                menu_items: row.lunch 
              };
            }
            if (row.dinner) {
              mergedDraft[`${dateStr}_dinner`] = { 
                ...mergedDraft[`${dateStr}_dinner`], 
                menu_items: row.dinner 
              };
            }
          }
        });
      };

      // Apply Week 1 data to the first 7 days
      if (parsedData.week1) {
        applyWeek(parsedData.week1, week1);
      }
      
      // Apply Week 2 data to the next 7 days
      if (parsedData.week2) {
        applyWeek(parsedData.week2, week2);
      }

      // Return the fully merged object to React state
      return mergedDraft;
    });
    
    // Automatically open the edit view so the admin can review the changes
    setIsEditing(true); 
  };

  // NEW: Sends the file to the background context
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Pass the triggerToast to the context so it can talk to the user from the background
    startParsing(file, triggerToast);
    
    if (fileInputRef.current) fileInputRef.current.value = ''; 
  };

  const handleCancel = () => {
    setDraftData(menuData);
    setIsEditing(false); // Wipes local storage via useEffect
  };

  const navigateWeeks = (weeks) => {
    if (isEditing) {
      const confirmLeave = window.confirm("You have unsaved changes. Discard them?");
      if (!confirmLeave) return;
      setIsEditing(false); // Clean up memory if they force leave
    }
    setCurrentMonday(addDays(currentMonday, weeks * 7));
  };

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="icon-btn" onClick={() => navigateWeeks(-2)}>
            <ChevronLeft size={18} />
          </button>
          <div style={{ fontWeight: 700, color: 'var(--text-main)', minWidth: '220px', textAlign: 'center' }}>
            {days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {days[13].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
          <button className="icon-btn" onClick={() => navigateWeeks(2)}>
            <ChevronRight size={18} />
          </button>
        </div>

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
            <>
              <input 
                type="file" 
                accept="application/pdf,image/*" 
                style={{ display: 'none' }} 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
              />
              <button 
                className="btn-ghost" 
                onClick={() => fileInputRef.current.click()} 
                disabled={isParsing || isLoading}
              >
                {isParsing ? <span className="spin">↻</span> : <Upload size={16} />} 
                {isParsing ? 'Parsing...' : 'Upload PDF'}
              </button>

              <button className="btn-primary" onClick={() => setIsEditing(true)}>
                <Edit3 size={16} /> Edit Menu
              </button>
            </>
          ) : (
            <>
              <button className="btn-ghost" onClick={handleCopyPrevious} disabled={isSaving || isLoading}>
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