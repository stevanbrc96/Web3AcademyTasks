import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function PriceChart({ chartData }) {
 
  const data = {
    labels: chartData.map(item => `Block ${item.blockNumber}`), 
    datasets: [
      {
        label: 'Price (TokenB / TokenA)',
        data: chartData.map(item => item.price), 
        fill: false,
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Token Price History',
      },
    },
  };

  return <Line options={options} data={data} />;
}

export default PriceChart;