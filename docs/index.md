# afm-host-panel

A Grafana panel plugin that hosts anywidget front-end modules (AFM). The
panel loads a widget module, gives it an element and a model, and feeds the
model from Grafana: query results, the time range and dashboard variables.
Widgets written for Jupyter run unchanged, within the limits listed in
[Compatibility and limits](compatibility.md).

- [User guide](guide.md): install, choose a widget, bind traits to data.
- [Design](design.md): how the host works and why.
- [Specification](specification.md): requirements (EARS, MoSCoW).
