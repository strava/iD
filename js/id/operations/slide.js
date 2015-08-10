iD.operations.Slide = function(selectedIds, context) {
    var slideOperationURI = window.location.hostname == 'localhost' ? "http://localhost:8200/slide" : "http://gometry.strava.com/slide";

    function sharedWayId(nodeIds) {
        var graph = context.graph(),
            wayIds, i, j;

        // way selected case
        if (nodeIds.length === 1) {
            if (context.geometry(nodeIds[0]) === 'line')
                return nodeIds[0];    
        }
        
        // nodes selected case
        wayIds = _.pluck(graph.parentWays(graph.entity(nodeIds[0])), 'id');
        for (i = 1; i < nodeIds.length; i++) {
            var vertexWayIds = _.pluck(graph.parentWays(graph.entity(nodeIds[i])), 'id');

            for (j = 0; j < wayIds.length; j++) {
                // this is wayId is not part of this vertex, remove it from wayIds
                if (!_.any(vertexWayIds, function(id) { return id === wayIds[j]; })) {
                    wayIds.splice(j, 1);
                    j--;
                }
            }

            if (wayIds.length === 0)
                return false; 
        }

        return wayIds[0];
    }

    function heatType() {
        var backgrounds = context.background().overlayLayerSources(),
            hasBoth = _.any(backgrounds, function(b) { return (b.sourcetag === "Strava Global Heat"); }),
            hasCycling = _.any(backgrounds, function(b) { return (b.sourcetag === "Strava Cycling Heat"); }),
            hasRunning = _.any(backgrounds, function(b) { return (b.sourcetag === "Strava Running Heat"); }),
            heat = "both";

        if (hasBoth || (hasCycling && hasRunning)) {
            heat = "both";
        } else if (hasCycling) {
            heat = "cycling";
        } else {
            heat = "running";
        }

        return heat;
    }

    var operation = function() {
        var annotation = t('operations.slide.annotation');

        var graph = context.graph(),
            wayId = sharedWayId(selectedIds),
            way = graph.entity(wayId),
            allNodes = _.uniq(graph.childNodes(way)),
            allNodeIds = _.pluck(allNodes, 'id'),
            relevantStartIndex, relevantEndIndex, relevantNodes,
            path, loading;

        // find the subset of the way to send to the server    
        if (selectedIds.length === 1) {
            // single way selected
            relevantStartIndex = 0;
            relevantEndIndex = allNodes.length - 1;
            relevantNodes = allNodes;
        } else {
            // a bunch of nodes selected
            var nodeIndexes = selectedIds.map(function(nodeId) {
                return _.indexOf(allNodeIds, nodeId);
            });

            relevantStartIndex = d3.min(nodeIndexes);
            relevantEndIndex = d3.max(nodeIndexes);
            relevantNodes = allNodes.slice(relevantStartIndex, relevantEndIndex + 1);
        }

        // path contains the array of tuples of the section to slide
        path = relevantNodes.map(function(node) {
            return [node.loc[1], node.loc[0]];
        });

        loading = iD.ui.Loading(context).blocking(true).message('Sliding');
        context.container().call(loading);

        // run the async request
        d3.json(slideOperationURI + '?data_tiles=' + heatType() + '&path=' + encodeURIComponent(polylineEncode(path)), 
            function(error, json) {
                loading.close();
                if (error) return console.warn(error);

                var action = iD.actions.Slide({
                    way: way,
                    allNodes: allNodes,
                    relevantNodes: relevantNodes,
                    relevantStartIndex: relevantStartIndex,
                    relevantEndIndex: relevantEndIndex,
                    points: decodePoints(json.corrected_path)
                }, context.projection);

                return context.perform(action, annotation);
            }
        );
    };

    // available if selected one way or multiple vertexes
    operation.available = function() {
        var vertexCount = 0;

        // selecting a single way case
        if (selectedIds.length == 1 && context.geometry(selectedIds[0]) === 'line')
            return true;

        // multiple vertexes
        _.forEach(selectedIds, function(id) {
            if (context.geometry(id) === 'vertex')
                vertexCount++;
        });

        return vertexCount >= 2;
    };

    operation.disabled = function() {
        return !sharedWayId(selectedIds);
    };

    operation.tooltip = function() {
        var disable = operation.disabled();
        return disable ?
            t('operations.slide.disabled') :
            t('operations.slide.description');
    };

    operation.id = 'slide';
    operation.keys = [t('operations.slide.key')];
    operation.title = t('operations.slide.title');

    /****************************************************************
     * polyline encoding stuff */
    function polylineEncode(points) {
        var factor = 1.0e6, pLat = 0, pLng = 0, result = "";

        for(var i = 0; i < points.length; i++) {
            var p = points[i],
                lat5 = Math.floor(p[0] * factor),
                lng5 = Math.floor(p[1] * factor), 
                deltaLat = lat5 - pLat,
                deltaLng = lng5 - pLng;

            pLat = lat5;
            pLng = lng5;

            result += encodeSignedNumber(deltaLat) + encodeSignedNumber(deltaLng);
        }

        return result;
    }

    function encodeNumber(num)  {
        var nextValue, finalValue, encodeString = "";

        while (num >= 0x20) {
            nextValue = (0x20 | (num & 0x1f)) + 63;
            encodeString += (String.fromCharCode(nextValue));
            num >>= 5;
        }
        
        finalValue = num + 63;
        encodeString += (String.fromCharCode(finalValue));
        
        return encodeString;
    }

    function encodeSignedNumber(num) {
        var sgn_num = num << 1;
        if (num < 0) {
            sgn_num = ~(sgn_num);
        }
        
        return encodeNumber(sgn_num);
    }

    function decodePoints(encoded) {
        var multiplier = 1.0e6,
            len = encoded.length, index = 0, polypath = [],
            count = 0, tempLatLng = [0, 0];

        while (index < len) {
            var b, shift = 0, result = 0;
            do {
                b = encoded.charCodeAt(index) - 63;
                index++;

                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);

            result = ((result & 1) ? ~(result >> 1) : (result >> 1));

            if (count%2 === 0) {
                result += tempLatLng[0];
                tempLatLng[0] = result;
            } else {
                result += tempLatLng[1];
                tempLatLng[1] = result;

                polypath.push([tempLatLng[1] / multiplier, tempLatLng[0] / multiplier]);
            }

            count++;
        }

        return polypath;
    }

    return operation;
};
