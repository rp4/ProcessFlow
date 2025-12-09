import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { SimulationResult } from '../types';

interface SimulationChartProps {
  data: SimulationResult[];
}

const SimulationChart: React.FC<SimulationChartProps> = ({ data }) => {
  return (
    <div className="w-full h-64 bg-white rounded-lg border border-slate-100 p-4 mt-3">
      <h4 className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Monte Carlo Distribution (10,000 runs)</h4>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="bin" 
            tick={{fontSize: 10, fill: '#64748b'}} 
            axisLine={false} 
            tickLine={false} 
          />
          <YAxis 
            tick={{fontSize: 10, fill: '#64748b'}} 
            axisLine={false} 
            tickLine={false}
            tickFormatter={(value) => `${value / 1000}k`}
          />
          <Tooltip 
            cursor={{fill: '#f1f5f9'}}
            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
          />
          <Bar dataKey="frequency" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={index > 6 ? '#ef4444' : '#3b82f6'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SimulationChart;