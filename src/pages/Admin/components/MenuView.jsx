import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { ChevronLeft, ChevronRight, Edit3, Save, X, Copy, Upload, Trash2 } from 'lucide-react';
import { useMenuParse } from '../../../context/MenuParseContext';

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
  const { isParsing, parsedRawData, startParsing, clearParsedData } = useMenuParse();
  const fileInputRef = useRef(null);

  const [currentMonday, setCurrentMonday] = useState(() => {
    const saved = localStorage.getItem('menu_currentMonday');
    return saved ? new Date(saved) : getMonday(new Date());
  });

  const [foodType, setFoodType] = useState(() => {
    return localStorage.getItem('menu_foodType') || 'regular';
  }); 

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [menuData, setMenuData] = useState({});

  const [isEditing, setIsEditing] = useState(() => {
    return localStorage.getItem('menu_isEditing') === 'true';
  });

  // FIX 1: Create a ref to track real-time editing state to prevent async closure bugs
  const isEditingRef = useRef(isEditing);
  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);
  
  const [draftData, setDraftData] = useState(() => {
    const saved = localStorage.getItem('menu_draftData');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('menu_isEditing', isEditing);
    localStorage.setItem('menu_foodType', foodType);
    localStorage.setItem('menu_currentMonday', currentMonday.toISOString());
    if (isEditing) {
      localStorage.setItem('menu_draftData', JSON.stringify(draftData));
    } else {
      localStorage.removeItem('menu_draftData');
    }
  }, [isEditing, draftData, foodType, currentMonday]);

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
      
      // FIX 2: Use the Ref. If applyParsedDataToDraft flipped isEditing to true 
      // while we were waiting for Supabase, this prevents it from overwriting the AI data.
      if (!isEditingRef.current) {
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

  useEffect(() => {
    if (parsedRawData) {
      applyParsedDataToDraft(parsedRawData);
      clearParsedData(); 
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedRawData]);

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

        // FIX 3: Prioritize originalItem.id. This ensures we don't accidentally try 
        // to insert a duplicate if the draft lost the ID during the parsing race condition.
        const targetId = originalItem.id || draftItem.id;

        if (targetId) {
          if (textValue !== originalText) {
            if (textValue === '') {
              updateOrDeletePromises.push(supabase.from('weekly_menu').delete().eq('id', targetId));
            } else {
              updateOrDeletePromises.push(supabase.from('weekly_menu').update({ menu_items: textValue }).eq('id', targetId));
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
      setIsEditing(false); 
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
          newDraft[key] = { ...newDraft[key], menu_items: item.menu_items };
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

  const handleClearMenu = () => {
    const confirmClear = window.confirm("Are you sure you want to clear the entire menu for these 2 weeks?");
    if (!confirmClear) return;

    setDraftData(prev => {
      const newDraft = { ...prev };
      days.forEach(day => {
        const dateStr = formatDate(day);
        MEALS.forEach(meal => {
          const key = `${dateStr}_${meal}`;
          newDraft[key] = { ...newDraft[key], menu_items: '' };
        });
      });
      return newDraft;
    });
  };

  const applyParsedDataToDraft = (parsedData) => {
    setDraftData(prevDraft => {
      const mergedDraft = { ...prevDraft };

      const applyWeek = (aiWeekArray, targetUiWeekArray) => {
        if (!Array.isArray(aiWeekArray)) return;
        
        aiWeekArray.forEach(row => {
          const targetDayDate = targetUiWeekArray.find(d => 
            d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() === row.day?.toLowerCase()
          );

          if (targetDayDate) {
            const dateStr = formatDate(targetDayDate);
            
            if (row.breakfast !== undefined) {
              mergedDraft[`${dateStr}_breakfast`] = { 
                ...mergedDraft[`${dateStr}_breakfast`], 
                menu_items: row.breakfast 
              };
            }
            if (row.lunch !== undefined) {
              mergedDraft[`${dateStr}_lunch`] = { 
                ...mergedDraft[`${dateStr}_lunch`], 
                menu_items: row.lunch 
              };
            }
            if (row.dinner !== undefined) {
              mergedDraft[`${dateStr}_dinner`] = { 
                ...mergedDraft[`${dateStr}_dinner`], 
                menu_items: row.dinner 
              };
            }
          }
        });
      };

      if (parsedData.week1) applyWeek(parsedData.week1, week1);
      if (parsedData.week2) applyWeek(parsedData.week2, week2);

      return mergedDraft;
    });
    
    setIsEditing(true); 
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    startParsing(file, triggerToast);
    if (fileInputRef.current) fileInputRef.current.value = ''; 
  };

  const handleCancel = () => {
    setDraftData(menuData);
    setIsEditing(false); 
  };

  const navigateWeeks = (weeks) => {
    if (isEditing) {
      const confirmLeave = window.confirm("You have unsaved changes. Discard them?");
      if (!confirmLeave) return;
      setIsEditing(false); 
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
              {MEALS.map(meal => <th key={meal} style={{ textTransform: 'capitalize' }}>{meal}</th>)}
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
        
        {!isEditing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button className="icon-btn" onClick={() => navigateWeeks(-1)}>
              <ChevronLeft size={18} />
            </button>
            <div style={{ fontWeight: 700, color: 'var(--text-main)', minWidth: '180px', textAlign: 'center' }}>
              {days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {days[13].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            <button className="icon-btn" onClick={() => navigateWeeks(1)}>
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {!isEditing && (
            <select 
              className="admin-filter-select"
              value={foodType}
              onChange={(e) => setFoodType(e.target.value)}
            >
              <option value="regular">Regular Menu</option>
              <option value="jain">Jain Menu</option>
            </select>
          )}

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

              <button className="btn-ghost" onClick={handleClearMenu} disabled={isSaving || isLoading}>
                <Trash2 size={16} /> Clear Menu
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