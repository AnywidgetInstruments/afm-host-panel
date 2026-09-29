# anywidget-automotives

[anywidget-automotives](https://s-celles.github.io/anywidget-automotives/)
plans automotive instruments (speedometer, tachometer, fuel and temperature
gauges, tell-tales, trip computer) as AFM modules built on
[anywidget-instruments](instruments.md). It is at the design stage: no widget
is published yet.

![The anywidget-automotives cluster preview](img/automotives-dark.png#only-dark)
![The anywidget-automotives cluster preview](img/automotives-light.png#only-light)

*The cluster preview of the demonstration dashboard, fed by TestData; the
engine tell-tale reads the `engine` variable.*

## What the plugin provides now

The registry reserves the `anywidget_automotives:` prefix with six
**previews**, drawn with anywidget-instruments widgets and the traits of the
cluster preview of anywidget-automotives:

| Entry | Drawn with | Preset traits |
|---|---|---|
| `anywidget_automotives:Speedometer` | `Gauge` | 0 to 200 km/h |
| `anywidget_automotives:Tachometer` | `Gauge` | 0 to 7000 rpm, amber zone from 5500, red zone from 6200 |
| `anywidget_automotives:FuelGauge` | `Tank` | 0 to 100 %, low-fuel limit at 12 % |
| `anywidget_automotives:TemperatureGauge` | `Thermometer` | 40 to 130 °C, limits 110 and 115 °C |
| `anywidget_automotives:TellTale` | `LED` | amber when on, neutral grey when off |
| `anywidget_automotives:TripComputer` | `SevenSegment` | 4 digits, 1 decimal, L/h |

Each preset can be changed with the static traits of the panel. The demo
dashboard shows the six previews as a cluster fed by TestData, with the
engine tell-tale bound to the `engine` variable.

The names follow the `module:Class` convention used by CAN & CANopen Studio
dashboards (`anywidget_automotives:Speedometer`), so a panel configured today
keeps its name when the real widget replaces the preview.

## When anywidget-automotives publishes its widgets

1. Vendor its built front end as anywidget-instruments is vendored
   (`scripts/vendor-instruments.mjs` shows the steps).
2. Point the `anywidget_automotives:*` entries of `src/afm/registry.ts` to it
   and drop `preview`.
3. Until then, a published module can already be loaded by URL (mode B).

## See also

- [anywidget-automotives documentation](https://s-celles.github.io/anywidget-automotives/):
  [widget catalog](https://s-celles.github.io/anywidget-automotives/widgets/),
  [use with CAN & CANopen Studio](https://s-celles.github.io/anywidget-automotives/integration/),
  [safety notice](https://s-celles.github.io/anywidget-automotives/safety/).
- [anywidget-instruments](instruments.md): the widgets that draw the previews.

!!! warning "Safety"
    Like anywidget-automotives itself, these displays are for visualization
    and teaching. They are not vehicle instruments.
