import { useState, useEffect } from 'react';

const useYamlLoader = () => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (window.jsyaml) {
      setLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js";
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);
  return loaded;
};

export default useYamlLoader;
