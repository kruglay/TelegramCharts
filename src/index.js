import Chart from './Chart.js'
import data from '../chart_data.js'

const app = document.getElementById("app");

data.forEach((chartData, i) => {
  const chart = new Chart({data: chartData, width: 500, height: 500, key: i});
  app.appendChild(chart.area);
});
