"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface BranchInventoryData {
  name: string;
  totalQuantity: number;
}

interface BranchInventoryChartProps {
  data: BranchInventoryData[];
  loading: boolean;
}

const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-2 bg-black/50 backdrop-blur-sm border border-white/20 rounded-md">
        <p className="label text-white">{`${label}`}</p>
        <p className="intro text-slate-200">{`Total Kuantitas : ${payload[0].value}`}</p>
      </div>
    );
  }

  return null;
};

const BranchInventoryChart: React.FC<BranchInventoryChartProps> = ({ data, loading }) => {
  return (
    <Card className="md:col-span-2 bg-black/20 backdrop-blur-lg border border-white/10 text-white">
      <CardHeader>
        <CardTitle>Distribusi Inventaris per Cabang</CardTitle>
        <CardDescription className="text-slate-300">Total kuantitas item di setiap cabang.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[300px] w-full bg-white/20" />
        ) : data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.2)" />
              <XAxis dataKey="name" tick={{ fill: '#cbd5e1' }} />
              <YAxis tick={{ fill: '#cbd5e1' }} />
              <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255, 255, 255, 0.1)'}}/>
              <Bar dataKey="totalQuantity">
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-400 text-center py-4">Tidak ada data inventaris yang tersedia untuk cabang.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default BranchInventoryChart;