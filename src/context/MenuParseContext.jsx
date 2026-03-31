import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const MenuParseContext = createContext();

export const useMenuParse = () => useContext(MenuParseContext);

export const MenuParseProvider = ({ children }) => {
  const [isParsing, setIsParsing] = useState(false);
  
  // Load any pending parsed data from a previous session/reload
  const [parsedRawData, setParsedRawData] = useState(() => {
    const saved = localStorage.getItem('pending_menu_parse');
    return saved ? JSON.parse(saved) : null;
  });

  // Save parsed data to localStorage so it survives page reloads
  useEffect(() => {
    if (parsedRawData) {
      localStorage.setItem('pending_menu_parse', JSON.stringify(parsedRawData));
    } else {
      localStorage.removeItem('pending_menu_parse');
    }
  }, [parsedRawData]);

  const startParsing = async (file, triggerToast) => {
    setIsParsing(true);
    triggerToast('success', 'Parsing menu in background. You can safely navigate away.');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.functions.invoke('parse-menu', {
        body: formData,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      console.log("=== RAW AI JSON START ===");
      console.log(data.parsedMenu);
      console.log("=== RAW AI JSON END ===");

      setParsedRawData(data.parsedMenu);
      triggerToast('success', 'Menu parsed successfully! Return to the Menu page to review.');
    } catch (error) {
      console.error('Upload Error:', error);
      triggerToast('error', 'Failed to read the file.');
    } finally {
      setIsParsing(false);
    }
  };

  const clearParsedData = () => setParsedRawData(null);

  return (
    <MenuParseContext.Provider value={{ isParsing, parsedRawData, startParsing, clearParsedData }}>
      {children}
    </MenuParseContext.Provider>
  );
};