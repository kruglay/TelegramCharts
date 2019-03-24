class Chart {
  constructor({
                data,
                width,
                height,
                ticksNumber = 7,
                xFormat = {day: '2-digit', month: 'short'},
                locale = window.navigator.languages[0] || 'en-US',
                key
              }) {
    this.key = key;
    this.dotR = 3;
    this.boundRoller = 5;
    this.distRoller = 100;
    this.brushHeight = 0.1 * height;
    this.listeners = [];
    this.rollPositions = [0, width];

    const {columns, types, names, colors} = data;
    const yColumns = columns.filter(col => col[0] !== 'x');
    this.yMaxValue = Math.max(...yColumns.map(col => col.slice(1)).flat());
    this.valueDivider = Math.floor(this.yMaxValue/5);
    this.yDivider = height / this.yMaxValue;
    this.yGridDivider = Math.floor(height - 20)/5;
    this.chartKeys = yColumns.map(col => col[0]);
    this.x = columns.filter(col => col[0] === 'x')[0].slice(1);
    this.minMaxIndex = [0, this.x.length - 1];
    this.nearest = Math.max(3, Math.ceil(this.x.length / 5));
    this.xDivider = width / (this.x.length - 1);
    this.xCoords = this.x
      .map((x, i, arr) => {
        return {
          coord: i === arr.length - 1 ? width : this.xDivider * i,
          range:
            i === arr.length - 1
              ? this.xDivider / 2 + width
              : this.xDivider / 2 + this.xDivider * i,
          index: i,
          x
        };
      })
      .sort((a, b) => a.range - b.range);
    this.xCoordsCutted = this.xCoords;
    this.charts = [];
    this.chartKeys.forEach(key => {
      const values = yColumns.filter(col => col[0] === key)[0].slice(1);
      const coords = values.map((value, index) => value === this.yMaxValue ? -height : -value * this.yDivider);
      const chart = {
        key,
        type: types[key],
        className: names[key].replace('#', ''),
        name: names[key],
        color: colors[key],
        values,
        valuesCutted: values,
        yCoords: coords,
        yCoordsBrush: coords,
        show: true,
      };
      this.charts.push(chart);
    });
    this.width = width;
    this.height = height;
    this.ticksNumber = ticksNumber;
    this.xFormat = xFormat;
    this.locale = locale;
    this.area = this.create();
    this.area.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    }, true);
    this.currentCoord = null;
    this._drawDots(true);
    this._drawXGrid(true);
    this._setEvents();
  }


  _cutCoords({xLeftCoord, xRightCoord, init = false}) {
    let xCutted, xLeft, xRight, i = 0;
    if (xLeftCoord !== undefined) {
      while (xLeftCoord > this.xCoords[i].coord) {
        i++;
      }
      xLeft = this.xCoords[i].x;
      this.minMaxIndex[0] = i;
    } else {
      xLeft = this.xCoords[this.minMaxIndex[0]].x;
    }

    if (xRightCoord !== undefined) {
      i = this.xCoords.length - 1;
      while (xRightCoord < this.xCoords[i].coord) {
        i--;
      }
      xRight = this.xCoords[i].x;
      this.minMaxIndex[1] = i;
    } else {
      xRight = this.xCoords[this.minMaxIndex[1]].x;
    }

    xCutted = this.x.filter(x => x >= xLeft && x <= xRight);

    this.xDivider = this.width / (xCutted.length - 1);
    this.xCoordsCutted = xCutted.map((x, i, arr) => {
      return {
        coord: i === arr.length - 1 ? this.width : this.xDivider * i,
        range:
          i === arr.length - 1
            ? this.xDivider / 2 + this.width
            : this.xDivider / 2 + this.xDivider * i,
        index: i,
        x
      };
    });
    // .sort((a, b) => a.range - b.range);//sort for easy if check in _setEvents
    const yValues = [];
    this.charts.filter(chart => chart.show).forEach(chart => {
      chart.valuesCutted = chart.values.slice(this.minMaxIndex[0], this.minMaxIndex[1] + 1);
      chart.yCoords = chart.valuesCutted.map(value => value === this.yMaxValue ? -this.height : -value * this.yDivider);
      yValues.push(chart.valuesCutted);
    });
    const oldyMaxValue = this.yMaxValue;
    this.yMaxValue = Math.max(...yValues.flat());
    this.yDivider = this.height/this.yMaxValue;
    if(Math.abs(oldyMaxValue-this.yMaxValue) > this.valueDivider) {
      this.charts.filter(chart => chart.show).forEach(chart => {
        chart.yCoords = chart.valuesCutted.map(value => value === this.yMaxValue ? -this.height : -value * this.yDivider);
      });
      this._drawYGrids(this.area.querySelector('.charts'));
    }
  }

  addListener(name, event, func) {
    this.listeners.push({name, event, func});
  }

  removeListener(name) {
    if (!this.listeners.length) return;
    const index = this.listeners.findIndex(el => el.name === name);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  emitEvent(event, params) {
    this.listeners.filter(listener => listener.event === event).forEach(listener => listener.func(params));
  }

  _drawBrushRects(brush) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('brush-rects');
    const rectBound = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rectBound.classList.add('brush-rects-bound');
    rectBound.setAttributeNS(null, 'width', this.width);
    rectBound.setAttributeNS(null, 'height', this.brushHeight);
    rectBound.setAttributeNS(null, 'x', 0);
    rectBound.setAttributeNS(null, 'y', -this.brushHeight);

    const rectLeft = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rectLeft.classList.add('brush-rects-left');
    rectLeft.setAttributeNS(null, 'width', 0);
    rectLeft.setAttributeNS(null, 'height', this.brushHeight);
    rectLeft.setAttributeNS(null, 'x', 0);
    rectLeft.setAttributeNS(null, 'y', -this.brushHeight);

    const lineLeft = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    lineLeft.classList.add('brush-lines-left');
    lineLeft.setAttributeNS(null, 'x1', 0);
    lineLeft.setAttributeNS(null, 'x2', 0);
    lineLeft.setAttributeNS(null, 'y1', -this.brushHeight);
    lineLeft.setAttributeNS(null, 'y2', 0);


    const rectRight = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rectRight.classList.add('brush-rects-right');
    rectRight.setAttributeNS(null, 'width', 0);
    rectRight.setAttributeNS(null, 'height', this.brushHeight);
    rectRight.setAttributeNS(null, 'x', this.width);
    rectRight.setAttributeNS(null, 'y', -this.brushHeight);
    const lineRight = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    lineRight.classList.add('brush-lines-right');
    lineRight.setAttributeNS(null, 'x1', this.width);
    lineRight.setAttributeNS(null, 'x2', this.width);
    lineRight.setAttributeNS(null, 'y1', -this.brushHeight);
    lineRight.setAttributeNS(null, 'y2', 0);

    this.addListener('moveLeftEvent', 'moveLeft', (({x}) => {
        const boundRight = +lineRight.getAttributeNS(null, 'x1') - this.distRoller;
        const range = Math.min(Math.max(x, 0), boundRight);
        lineLeft.setAttributeNS(null, 'x1', range);
        lineLeft.setAttributeNS(null, 'x2', range);

        rectLeft.setAttributeNS(null, 'width', range);
        this._cutCoords({xLeftCoord: range});
        this.emitEvent('drawChart', {svg: this.area.querySelector('.charts')});
        this._drawXGrid();
        this._drawXAxis(this.area.querySelector('.x-axis'));
      })
    );

    this.addListener('moveRightEvent', 'moveRight', (({x}) => {
        const boundLeft = +lineLeft.getAttributeNS(null, 'x1') + this.distRoller;
        const range = Math.max(Math.min(x, this.width), boundLeft);
        lineRight.setAttributeNS(null, 'x1', range);
        lineRight.setAttributeNS(null, 'x2', range);

        rectRight.setAttributeNS(null, 'x', range);
        rectRight.setAttributeNS(null, 'width', this.width - range);
        this._cutCoords({xRightCoord: range});
        this.emitEvent('drawChart', {svg: this.area.querySelector('.charts')});
        this._drawXGrid();
        this._drawXAxis(this.area.querySelector('.x-axis'));
      })
    );

    this.addListener('moveEvent', 'move', ({x}) => {
      const boundLeft = +lineLeft.getAttributeNS(null, 'x1');
      const boundRight = +lineRight.getAttributeNS(null, 'x1');
      if (
        (boundLeft === 0 && x < 0) ||
        (boundRight === this.width && x > 0) ||
        boundLeft === 0 && boundRight === this.width
      ) {
        return;
      }
      this.emitEvent('moveLeft', {x: boundLeft + x, noCut: true});
      this.emitEvent('moveRight', {x: boundRight + x, noCut: true});
    });


    g.appendChild(rectBound);
    g.appendChild(rectLeft);
    g.appendChild(rectRight);
    g.appendChild(lineLeft);
    g.appendChild(lineRight);
    this._setBrushEvent({element: lineRight, event: 'moveRight'});
    this._setBrushEvent({element: lineLeft, event: 'moveLeft'});
    this._setBrushEvent({element: rectBound, event: 'move'});
    brush.appendChild(g);
  }

  _setBrushEvent({element, event}) {
    let down = false;
    element.addEventListener('mousedown', e => {
      down = true;
    });
    element.addEventListener('mousemove', e => {
      if (down) {
        this.emitEvent(event, {x: event === 'move' ? e.movementX : e.offsetX});
      }
    });
    element.addEventListener('mouseout', e => {
      if (down) {
        down = false;
        this._drawDots();
      }
    });
    element.addEventListener('mouseup', e => {
      if (down) {
        down = false;
        this._drawDots();
      }

    });
  }


  _setEvents() {
    const svg = this.area.querySelector('svg');
    const legend = this.area.querySelector('.charts-legend');
    svg.addEventListener('mousemove', e => {
      const legendRect = legend.getClientRects()[0];
      if (
        e.clientX >= (legendRect.left - 10) && e.clientX <= (legendRect.right + 10)
        &&
        e.clientY >= (legendRect.top - 10) && e.clientY <= (legendRect.bottom + 10)
      ) {
        legend.classList.add('under-layer');
      } else {
        legend.classList.remove('under-layer');
      }
      for (let coord of this.xCoordsCutted) {
        if (e.offsetX <= coord.range) {
          this.currentCoord = coord;
          this.charts
            .filter(chart => chart.show)
            .forEach(chart => {
              const upBound = (coord.index + this.nearest) >= (this.xCoordsCutted.length - 1) ? (this.xCoordsCutted.length - 1) : (coord.index + this.nearest),
                downBound = coord.index - this.nearest < 0 ? 0 : coord.index - this.nearest;
              for (let i = downBound; i <= upBound; i++) {
                const xGrid = this.area.querySelector(
                  `.x-grid-line-${i}`
                  ),
                  dot = this.area.querySelector(
                    `.name-${chart.className} .dot-${i}`
                  );
                if (i === coord.index) {
                  dot.classList.remove('hidden');
                  xGrid.classList.remove('hidden');
                } else {
                  dot.classList.add('hidden');
                  xGrid.classList.add('hidden');
                }
              }
              ;
            });
          this._setLegendValues(coord.index);
          this._setLegendDate(
            new Date(this.x[coord.index]).toLocaleString(this.locale, {
              ...this.xFormat,
              weekday: 'short'
            })
          );
          legend.classList.remove('hidden');
          return;
        }
      }


    });

    svg.addEventListener('mouseout', e => {
      if (this.currentCoord) {
        this.charts
          .filter(chart => chart.show)
          .forEach(chart => {
            const dot = this.area.querySelector(
              `.name-${chart.className} .dot-${this.currentCoord.index}`
            );
            const xGrid = this.area.querySelector(
              `.x-grid-line-${this.currentCoord.index}`
            );
            dot.classList.add('hidden');
            xGrid.classList.add('hidden');
            this.area.querySelector('.charts-legend').classList.add('hidden');
          });
      }
    });
  }

  _drawChart({svg, chart, brush = false, init = false}) {
    const {color, className, type, yCoords, yCoordsBrush, show} = chart;
    const coords = brush ? yCoordsBrush : yCoords;
    const xCoords = brush ? this.xCoords : this.xCoordsCutted;
    const yRatio = brush ? this.brushHeight / this.height : 1;
    let g = svg.querySelector(`.chart.name-${className}-${type}`), path;
    if (!show) {
      g && g.parentNode.removeChild(g);
      return;
    }

    if (g) {
      path = g.firstChild;
    } else {
      g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.classList.add(`chart`);
      g.classList.add(`name-${className}-${type}`);
      path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttributeNS(null, 'stroke', color);
      g.appendChild(path);
      svg.insertBefore(g, svg.firstChild);
    }

    if (type === 'line') {
      let d = `M ${xCoords[0].coord},${coords[0] * yRatio} L`;
      for (let i = 1; i < xCoords.length; i++) {
        d += ` ${xCoords[i].coord},${coords[i] * yRatio}`;
      }
      path.setAttributeNS(null, 'd', d);
    }
  }

  _drawYGrid({g, y, value, index}) {
    const childs = g.querySelectorAll('.y-grid-line');
    const yCoord = y || -index * this.yGridDivider;
    let line;
    if(childs.length) {
      line = childs[index];
    }
    if(!line) {
      line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.classList.add('y-grid-line');
      line.setAttributeNS(null, 'x1', 0);
      line.setAttributeNS(null, 'y1', yCoord);
      line.setAttributeNS(null, 'x2', this.width);
      line.setAttributeNS(null, 'y2', yCoord);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.classList.add('y-grid-text');
      text.setAttributeNS(null, 'y', yCoord - 5);
      text.textContent = index*this.valueDivider;
      text.setAttributeNS(null, 'text-anchor', 'left');

      g.append(line, text);
    } else {
      const y = +line.getAttributeNS(null, 'y1');
      if(y !== yCoord) {
        line.setAttributeNS(null, 'y1', yCoord);
        line.setAttributeNS(null, 'y2', yCoord);
      }
      line.nextSibling.textContent = index*this.valueDivider;
    }
  }

  _drawYGrids(svg) {
    let g = svg.querySelector('.y-grid');
    if(!g) {
      g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.classList.add('y-grid');
      svg.appendChild(g);
    }
    if (this.yMaxValue <= 10) {
      g.innerHTML = '';
      this._drawYGrid({g, y: Math.floor(this.height / 2), value: Math.floor(this.yMaxValue / 2)});
    } else {
      const divider = Math.floor((this.height - 20) / 5);
      this.valueDivider = Math.floor(this.yMaxValue/5);
      for (let i = 0; i <= 5; i++) {
        this._drawYGrid({g, index: i});
      }
    }

  }

  _drawXTicks(g) {
    const lapse = Math.ceil(this.xCoordsCutted.length / this.ticksNumber);
    const ticks = [];
    const texts = [];
    for (let i = 0; i < this.xCoordsCutted.length; i += lapse) {
      if (this.xCoordsCutted[i]) {
        ticks.push(this.xCoordsCutted[i].x);
      } else {
        ticks.push(this.xCoordsCutted.slice(-1).x);
      }
    }
    const ticksFormatted = ticks
      .map(tick => new Date(tick).toLocaleString(this.locale, this.xFormat))
      .filter((tick, i, arr) => arr.indexOf(tick) === i);

    const textNodes = g.childNodes;
    ticksFormatted.forEach((el, i, arr) => {
      if (arr.length === 1) {
        text.setAttributeNS(null, 'x', `${this.width / 2}`);
      }
      if (i === 0 || i === arr.length - 1) return;
      let text = textNodes[i - 1];
      if(!text) {
        text = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'text'
        );
        text.setAttributeNS(null, 'text-anchor', 'middle');
        text.classList.add('x-tick-text');
        text.setAttributeNS(
          null,
          'x',
          `${
            i === arr.length - 1
              ? this.width - 10
              : (this.width * i) / (arr.length - 1)
            }`
        );
        text.setAttributeNS(null, 'y', `15`);
        text.textContent = el;

      }
      text.textContent = el;
      texts.push(text);
    });
    g.innerHTML = '';
    g.append(...texts);
  }

  _drawXAxis(svg) {
    let g = svg.firstElementChild;
    if(!g) {
      g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      svg.appendChild(g);
    }
    //add text

    this._drawXTicks(g);
  }

  _drawDots(init = false) {

    this.charts
      .filter(chart => chart.show)
      .forEach(chart => {
        let g;
        if (init) {
          g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          g.classList.add('charts-dots');
          g.classList.add(`name-${chart.className}`);
          g.style.stroke = chart.color;
        } else {
          g = this.area.querySelector(`.charts-dots.name-${chart.className}`);
        }

        //remove no needs dots
        if (!init) {
          for (let i = chart.yCoords.length; i < this.x.length; i++) {
            const dot = g.querySelector(`.dot-${i}`);
            if (dot) {
              g.removeChild(dot);
            }
          }
        }

        chart.yCoords.forEach((yCoord, i) => {
          let dot = g.querySelector(`.dot-${i}`);
          if (!dot) {
            dot = document.createElementNS(
              'http://www.w3.org/2000/svg',
              'circle'
            );
            dot.classList.add(`dot-${i}`);
            dot.classList.add('hidden');
            dot.setAttributeNS(null, 'r', this.dotR);
            g.appendChild(dot);
          }

          dot.setAttributeNS(
            null,
            'cx',
            this.xCoordsCutted[i].coord
          );

          dot.setAttributeNS(null, 'cy', yCoord);
        });

        if (init) this.area.querySelector('svg').appendChild(g);
      });
  }

  _drawXGrid(init = false) {
    const svg = this.area.querySelector('svg');
    let g;
    if (init) {
      g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.classList.add('x-grid');
      svg.appendChild(g);
    } else {
      g = svg.querySelector('.x-grid');
    }

    if (!init) {
      for (let i = this.xCoordsCutted.length; i < this.x.length; i++) {
        const line = g.querySelector(`.x-grid-line-${i}`);
        if (line) {
          g.removeChild(line);
        }
      }
    }

    this.xCoordsCutted.forEach((coord, index) => {
      let line = g.querySelector(`.x-grid-line-${index}`);
      if (!line) {
        line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('x-grid-line');
        line.classList.add(`x-grid-line-${index}`);
        line.classList.add(`hidden`);
        g.appendChild(line);
      }
      line.setAttributeNS(null, 'x1', coord.coord);
      line.setAttributeNS(null, 'x2', coord.coord);
      line.setAttributeNS(null, 'y1', 0);
      line.setAttributeNS(null, 'y2', -this.height);
    });
  }

  _setLegendValues(index) {
    this.charts
      .forEach(chart => {
        const inst = this.area.querySelector(
          `.charts-legend-instance-${chart.className}`
        );
        chart.show ? inst.classList.remove('dn') : inst.classList.add('dn');
        this.area.querySelector(
          `.charts-legend-value-${chart.className}`
        ).textContent = chart.valuesCutted[index];
        this.area.querySelector(
          `.charts-legend-instance-${chart.className} .charts-legend-name`
        ).textContent = chart.name;
      });
  }

  _setLegendDate(date) {
    this.area.querySelector('.charts-legend-date').textContent = date;
  }

  _drawLegendContent(legend) {
    const divDate = document.createElement('div'),
      divValues = document.createElement('div');
    divDate.classList.add('charts-legend-date');
    divValues.classList.add('charts-legend-values');
    this.charts
      .filter(chart => chart.show)
      .forEach(chart => {
        const divInstance = document.createElement('div'),
          divValue = document.createElement('div'),
          divName = document.createElement('div');
        divInstance.style.color = chart.color;
        divInstance.className = `charts-legend-instance-${chart.className}`;
        divValue.className = `charts-legend-value-${chart.className}`;
        divName.classList.add('charts-legend-name');
        divInstance.appendChild(divValue);
        divInstance.appendChild(divName);
        divValues.appendChild(divInstance);
      });
    legend.appendChild(divDate);
    legend.appendChild(divValues);
    legend.addEventListener('mouseover', e => {
      legend.classList.add('under-layer');
    });
    legend.addEventListener('mouseout', e => {
      legend.classList.remove('under-layer');
    });
    legend.classList.add('under-layer');
  }

  _drawLegend(wrapper) {
    const div = document.createElement('div');
    div.className = 'charts-legend hidden';
    wrapper.appendChild(div);
  }

  _drawCheckbox({chart, container}) {
    const {name, color, className} = chart;

    const input = document.createElement('input');
    const label = document.createElement('label');
    const span = document.createElement('span');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    input.classList.add('checkbox');
    input.id = `ch-item-${className}-${this.key}`;
    input.setAttribute('type', 'checkbox');
    input.checked = true;

    label.setAttribute('for', input.id);
    span.style.color = color;
    span.textContent = name;

    svg.classList.add('checkmark');
    svg.classList.add(input.id);
    svg.setAttributeNS(null, 'viewBox', '0 0 52 52');

    path.setAttributeNS(null, 'd', 'M14.1 27.2l7.1 7.2 16.7-16.8');
    path.classList.add('checkmark-check');

    circle.classList.add('checkmark-fill');
    circle.setAttributeNS(null, 'cx', 26);
    circle.setAttributeNS(null, 'cy', 26);
    circle.setAttributeNS(null, 'r', 25);
    circle.setAttributeNS(null, 'fill', color);
    circle.setAttributeNS(null, 'stroke', color);

    container.appendChild(input);
    container.appendChild(label);
    label.appendChild(svg);
    label.appendChild(span);
    svg.appendChild(circle);
    svg.appendChild(path);

    input.addEventListener('change', (e) => {
      const {target} = e;
      circle.setAttributeNS(null, 'fill', target.checked ? color : 'none');
      chart.show = target.checked;
      this._cutCoords({
        xLeftCoord: this.area.querySelector('.brush-lines-left').getAttributeNS(null, 'x1'),
        xRightCoord: this.area.querySelector('.brush-lines-right').getAttributeNS(null, 'x1')
      });
      this.emitEvent('drawChart', {svg: this.area.querySelector('.charts')});
      this.emitEvent('drawChart', {svg: this.area.querySelector('.brush'), brush: true});
    });
  }

  _drawCheckboxes(div) {
    const container = document.createElement('div');
    container.classList.add('checkbox-container');
    this.charts.forEach(chart => {
      this._drawCheckbox({chart, container});
    });
    div.appendChild(container);

  }

  _drawModeSwitcher(div) {
    const switcher = document.createElement('div');
    switcher.classList.add('switcher');
    switcher.textContent = `Switch to night mode`;
    div.appendChild(switcher);
    switcher.addEventListener('click', () => {
      const res = this.area.classList.toggle('dark');
      switcher.textContent = res ? `Switch to night mode` : `Switch to day mode`;
    });
  }

  create() {
    const div = document.createElement('div');
    div.classList.add('charts-wrapper');
    div.style.width = `${this.width}px`;
    const h2 = document.createElement('h2');
    h2.textContent = 'Followers';
    div.appendChild(h2);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('charts');
    svg.setAttributeNS(
      null,
      'viewBox',
      `0 -${this.height} ${this.width} ${this.height}`
    );
    svg.setAttributeNS(null, 'width', `${this.width}`);
    svg.setAttributeNS(null, 'height', `${this.height}`);
    const svgX = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgX.classList.add('x-axis');
    svgX.setAttributeNS(null, 'width', `${this.width}`);
    svgX.setAttributeNS(null, 'height', 25);
    this._drawXAxis(svgX);

    this._drawYGrids(svg);

    this.addListener('drawChartEvent', 'drawChart', (params) => {
      const {svg, init, brush} = params;
      this.charts.forEach(chart => this._drawChart({svg, chart, init, brush}));
    });
    this.emitEvent('drawChart', {svg: svg, init: true});

    div.appendChild(svg);
    div.appendChild(svgX);

    const svgBrush = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgBrush.classList.add('brush');
    const brushRatio = this.brushHeight / this.height;
    svgBrush.setAttributeNS(
      null,
      'viewBox',
      `0 -${this.brushHeight} ${this.width} ${this.brushHeight}`
    );
    svgBrush.setAttributeNS(null, 'width', `${this.width}`);
    svgBrush.setAttributeNS(null, 'height', `${this.brushHeight}`);
    this.emitEvent('drawChart', {svg: svgBrush, brush: true, init: true});
    this._drawBrushRects(svgBrush);
    div.appendChild(svgBrush);
    this._drawLegend(div);
    this._drawLegendContent(div.querySelector('.charts-legend'));
    this._drawCheckboxes(div);
    this._drawModeSwitcher(div);

    return div;

  }
}

export default Chart;
