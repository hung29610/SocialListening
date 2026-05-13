'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * SIMPLE TEST COMPONENT
 * Để verify rằng React state và onClick handlers hoạt động
 */
export default function TestInteractive() {
  const [count, setCount] = useState(0);
  const [toggle, setToggle] = useState(false);
  const [text, setText] = useState('');

  const handleClick = () => {
    console.log('🔵 Button clicked! Count:', count);
    setCount(count + 1);
    toast.success(`✅ Clicked ${count + 1} times!`);
  };

  const handleToggle = () => {
    console.log('🔵 Toggle clicked! New value:', !toggle);
    setToggle(!toggle);
    toast.success(`✅ Toggle is now ${!toggle ? 'ON' : 'OFF'}`);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🔵 Text changed:', e.target.value);
    setText(e.target.value);
  };

  const handleSave = async () => {
    console.log('🔵 Save clicked!');
    console.log('🔵 Current state:', { count, toggle, text });
    
    toast.success('✅ Save button works!');
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success('✅ Simulated API call completed!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">🧪 Test Interactive Components</h2>
        <p className="text-sm text-gray-600 mt-1">
          Nếu bạn thấy page này và các buttons hoạt động → React state OK
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
        {/* Test 1: Counter */}
        <div className="border-b pb-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Test 1: Counter Button</h3>
          <p className="text-sm text-gray-600 mb-3">
            Click count: <span className="font-bold text-blue-600">{count}</span>
          </p>
          <button
            onClick={handleClick}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Click Me! ({count})
          </button>
        </div>

        {/* Test 2: Toggle */}
        <div className="border-b pb-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Test 2: Toggle Switch</h3>
          <p className="text-sm text-gray-600 mb-3">
            Toggle state: <span className="font-bold text-blue-600">{toggle ? 'ON' : 'OFF'}</span>
          </p>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={toggle}
              onChange={handleToggle}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            <span className="ml-3 text-sm font-medium text-gray-900">
              {toggle ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>

        {/* Test 3: Text Input */}
        <div className="border-b pb-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Test 3: Text Input</h3>
          <p className="text-sm text-gray-600 mb-3">
            Text value: <span className="font-bold text-blue-600">{text || '(empty)'}</span>
          </p>
          <input
            type="text"
            value={text}
            onChange={handleTextChange}
            placeholder="Type something..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Test 4: Save Button */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Test 4: Save Button</h3>
          <button
            onClick={handleSave}
            className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save All
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">📋 Hướng dẫn test:</h3>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Mở Console (F12)</li>
          <li>Click các buttons và toggle</li>
          <li>Xem console logs (🔵)</li>
          <li>Xem toast notifications (✅)</li>
          <li>Nếu TẤT CẢ hoạt động → React state OK, vấn đề ở Settings components</li>
          <li>Nếu KHÔNG hoạt động → React/Next.js có vấn đề</li>
        </ol>
      </div>

      {/* Debug Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">🐛 Debug Info:</h3>
        <pre className="text-xs text-gray-700 font-mono">
          {JSON.stringify({ count, toggle, text }, null, 2)}
        </pre>
      </div>
    </div>
  );
}
