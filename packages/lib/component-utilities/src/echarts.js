import { registerTheme, init, connect } from 'echarts';
import { evidenceThemeLight } from './echartsThemes';
import debounce from 'debounce';
import * as chartWindowDebug from './chartWindowDebug';

/**
 * @typedef {import("echarts").EChartsOption & {
 * 		dispatch?: ReturnType<typeof import("svelte").createEventDispatcher>;
 * 		showAllXAxisLabels?: boolean;
 * 	}
 * } ActionParams
 */

const ANIMATION_DURATION = 500;

/** @type {import("svelte/action").Action<HTMLElement, ActionParams>} */
export default (node, option) => {
	// https://github.com/evidence-dev/evidence/issues/1323
	const useSvg =
		['iPad Simulator', 'iPhone Simulator', 'iPod Simulator', 'iPad', 'iPhone', 'iPod'].includes(
			navigator.platform
			// ios breaks w/ canvas if the canvas is too large
		) && node.clientWidth * 3 * node.clientHeight * 3 > 16777215;

	registerTheme('evidence-light', evidenceThemeLight);

	const chart = init(node, 'evidence-light', {
		renderer: useSvg ? 'svg' : (option.renderer ?? 'canvas')
	});

	chartWindowDebug.set(chart.id, chart);

	// If connectGroup supplied, connect chart to other charts matching that connectGroup
	if (option.connectGroup) {
		chart.group = option.connectGroup;
		connect(option.connectGroup);
	}

	// This function applies overrides to the echarts config generated by our chart components.
	// In cases where these affect the spacing of the chart, some jumping/reanimation will be visible when
	// the chart is animated. This is because we need to pass the initial options without the overrides to echarts
	// first in order to use setOption()'s built-in merge capability. I believe the only way around this is
	// to handle the option merge ourselves, then pass the final config object to setOption().

	// Series Color override
	const applySeriesColors = () => {
		if (option.seriesColors) {
			/** @type {import("echarts").EChartsOption} */
			const prevOption = chart.getOption();
			if (!prevOption) return;
			const newOption = { ...prevOption };
			for (const seriesName of Object.keys(option.seriesColors)) {
				const matchingSeriesIndex = prevOption.series.findIndex((s) => s.name === seriesName);
				if (matchingSeriesIndex !== -1) {
					newOption.series[matchingSeriesIndex] = {
						...newOption.series[matchingSeriesIndex],
						itemStyle: {
							...newOption.series[matchingSeriesIndex].itemStyle,
							color: option.seriesColors[seriesName]
						}
					};
				}
			}
			chart.setOption(newOption);
		}
	};

	// Check if echartsOptions are provided and apply them
	const applyEchartsOptions = () => {
		if (option.echartsOptions) {
			chart.setOption({
				...option.echartsOptions
			});
		}
	};

	// seriesOptions - loop through series and apply same changes to each
	const applySeriesOptions = () => {
		let tempSeries = [];
		if (option.seriesOptions) {
			const reference_index = option.config.series.reduce(
				(acc, { evidenceSeriesType }, reference_index) => {
					if (
						evidenceSeriesType === 'reference_line' ||
						evidenceSeriesType === 'reference_area' ||
						evidenceSeriesType === 'reference_point'
					) {
						acc.push(reference_index);
					}
					return acc;
				},
				[]
			);

			for (let i = 0; i < option.config.series.length; i++) {
				if (reference_index.includes(i)) {
					tempSeries.push({});
				} else {
					tempSeries.push({ ...option.seriesOptions });
				}
			}
			chart.setOption({ series: tempSeries });
		}
	};

	// Initial options set:
	chart.setOption({
		...option.config,
		animationDuration: ANIMATION_DURATION,
		animationDurationUpdate: ANIMATION_DURATION
	});

	applySeriesColors();
	applyEchartsOptions();
	applySeriesOptions();

	// Click event handler:
	const dispatch = option.dispatch;
	chart.on('click', function (params) {
		dispatch('click', params);
	});

	// watching parent element is necessary for charts within `Fullscreen` components
	const parentElement = node.parentElement;
	const onWindowResize = debounce(() => {
		chart.resize({
			animation: {
				duration: ANIMATION_DURATION
			}
		});
		updateLabelWidths();
	}, 100);

	let resizeObserver;
	if (window.ResizeObserver && parentElement) {
		resizeObserver = new ResizeObserver(onWindowResize);
		resizeObserver.observe(parentElement);
	} else {
		window.addEventListener('resize', onWindowResize);
	}

	// Label width setting:
	const updateLabelWidths = () => {
		if (option.showAllXAxisLabels) {
			// Make sure we operate on an up-to-date options object
			/** @type {import("echarts").EChartsOption} */
			const prevOption = chart.getOption();
			if (!prevOption) return;
			// If the options object includes showing all x axis labels
			// Note: this isn't a standard option, but right now this is the easiest way to pass something to the action.
			// We don't want to have multiple resize observers if we can avoid it, and this is all due for a cleanup anyways
			// Get all the possible x values
			const distinctXValues = new Set(prevOption.series.flatMap((s) => s.data?.map((d) => d[0])));
			const modConst = 4 / 5;
			const clientWidth = node?.clientWidth ?? 0;

			// We disable this behavior because it doesn't make sense on horizontal bar charts
			// Category labels will grow to be visible
			// Value labels are interpolatable anyway
			if (!option.swapXY) {
				/** @type {import("echarts").EChartsOption} */
				const newOption = {
					xAxis: {
						axisLabel: {
							interval: 0,
							overflow: 'truncate',
							width: (clientWidth * modConst) / distinctXValues.size
						}
					}
				};
				chart.setOption(newOption);
			}
		}
	};

	const updateChart = (newOption) => {
		option = newOption;
		chart.setOption(
			{
				...option.config,
				animationDuration: ANIMATION_DURATION,
				animationDurationUpdate: ANIMATION_DURATION
			},
			true
		);
		applySeriesColors();
		applyEchartsOptions();
		applySeriesOptions();
		chart.resize({
			animation: {
				duration: ANIMATION_DURATION
			}
		});
		updateLabelWidths();
	};

	onWindowResize();

	window[Symbol.for('chart renders')] ??= 0;
	window[Symbol.for('chart renders')]++;
	return {
		update(option) {
			window[Symbol.for('chart renders')]++;
			updateChart(option);
		},
		destroy() {
			if (resizeObserver) {
				resizeObserver.unobserve(parentElement);
			} else {
				window.removeEventListener('resize', onWindowResize);
			}
			chart.dispose();

			chartWindowDebug.unset(chart.id);
		}
	};
};
