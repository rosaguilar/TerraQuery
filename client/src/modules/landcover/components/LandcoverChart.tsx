import { useMemo } from 'react';
import { Sankey, Tooltip, ResponsiveContainer, Layer, Rectangle } from 'recharts';

function CustomNode({ x, y, width, height, index, payload, datasetConfig, stats }: any) {
  const isRightSide = x > 150;

  let color = '#999';
  let cleanName = payload.name;

  if (datasetConfig && stats) {
    cleanName = payload.name
      .replace(` (${datasetConfig.startYear})`, '')
      .replace(` (${datasetConfig.endYear})`, '');
    const colorIndex = datasetConfig.classNames.indexOf(cleanName);
    if (colorIndex !== -1) {
      color = '#' + datasetConfig.palette[colorIndex];
    }
  }

  return (
    <Layer key={`CustomNode${index}`}>
      <Rectangle x={x} y={y} width={width} height={height} fill={color} fillOpacity="1" rx={2} ry={2} />
      <text
        textAnchor={isRightSide ? 'start' : 'end'}
        x={isRightSide ? x + width + 8 : x - 8}
        y={y + height / 2}
        dy={3}
        fontSize="12"
        fill="#222"
        fontWeight="600"
      >
        {cleanName}
      </text>
    </Layer>
  );
}

export default function LandcoverChart({ stats, datasetConfig }: { stats: any; datasetConfig: any }) {
  const chartData = useMemo(() => {
    if (!stats?.transitions || !datasetConfig) return { nodes: [], links: [] };

    const nodesMap = new Map<string, number>();
    const links: any[] = [];
    let nodeIndex = 0;

    const getNodeIndex = (name: string) => {
      if (!nodesMap.has(name)) nodesMap.set(name, nodeIndex++);
      return nodesMap.get(name)!;
    };

    Object.entries(stats.transitions).forEach(([transitionKey, value]) => {
      if ((value as number) < 5) return;
      const [sourceName, targetName] = transitionKey.split(' -> ');
      const sourceId = getNodeIndex(`${sourceName} (${datasetConfig.startYear})`);
      const targetId = getNodeIndex(`${targetName} (${datasetConfig.endYear})`);
      links.push({ source: sourceId, target: targetId, value });
    });

    const nodes = Array.from(nodesMap.keys()).map(name => ({ name }));
    return { nodes, links };
  }, [stats, datasetConfig]);

  if (!chartData.nodes.length) return null;

  return (
    <div className="w-[460px] h-[380px] bg-white/95 rounded-xl p-4 shadow-xl backdrop-blur">
      <h3 className="text-center text-sm font-bold text-slate-800 mb-2">
        Land Cover Transitions {datasetConfig ? `(${datasetConfig.startYear} - ${datasetConfig.endYear})` : ''} (Hectares)
      </h3>
      <ResponsiveContainer width="100%" height="92%">
        <Sankey
          data={chartData}
          node={<CustomNode datasetConfig={datasetConfig} stats={stats} />}
          nodePadding={10}
          margin={{ top: 10, left: 140, right: 140, bottom: 10 }}
          link={{ stroke: '#777' }}
        >
          <Tooltip
            formatter={(value: number) => [`${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} ha`, 'Area']}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', fontSize: '12px' }}
          />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
}
