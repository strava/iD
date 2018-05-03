/* warning!!
 *
 * this is still early code and tests need to be added */
iD.actions.Slide = function(options, projection) {
    function nodeInteresting(graph, node) {
        return graph.parentWays(node).length > 1 ||
            graph.parentRelations(node).length ||
            node.hasInterestingTags();
    }

    var action = function(graph) {
        var way = options.way,
            allNodes = options.allNodes,
            relevantNodes = options.relevantNodes,
            relevantStartIndex = options.relevantStartIndex,
            relevantEndIndex = options.relevantEndIndex,
            points = options.points,
            closesPointIndex = [],
            newNodes, newNodeIds, i, j;

        // relevantNodes are the subset of the way is being slided.
        // creates closesPointIndex, an injective mapping, 
        // which foreach relevant node finds the closest new node.
        // skips 'keyNodes' which are members of othe ways
        var previousClosest = 0;
        closesPointIndex.push(0);
        for (i = 1; i < relevantNodes.length - 1; i++) {
            var node = relevantNodes[i],
                start = previousClosest + 1;

            // member of other ways so, want keep it around the move it smartly
            if (nodeInteresting(graph, node)) {
                closesPointIndex.push(null);
                continue;
            }

            var minDistIndex = null, minDist = Number.MAX_VALUE;
            for (j = start; j < points.length - 1; j++) {
                var dist = iD.geo.sphericalDistance(node.loc, points[j]);
                if (dist < minDist) {
                    minDist = dist;
                    minDistIndex = j;
                }
            }

            // couldn't find a closest because we have less new points than old, so delete it. 
            // we know it's uninteresting because of check above
            if (minDistIndex === null) {
                graph = iD.actions.DeleteNode(node.id)(graph);
            } else {
                previousClosest = minDistIndex;
            }

            closesPointIndex.push(minDistIndex);
        }
        closesPointIndex.push(points.length-1);  // first and last don't move, thus stay the same node

        // move the existing nodes and create the new ones.
        previousClosest = 0;
        newNodes = [relevantNodes[0]]; // first node doesn't move
        for (i = 1; i < relevantNodes.length; i++) {
            if (closesPointIndex[i] === null) {
                // interesting so we do a special placement in the next loop
                continue;
            }

            for (j = previousClosest + 1; j < closesPointIndex[i]; j++) {
                var newNode = iD.Node({loc: points[j]});
                newNodes.push(newNode);

                graph = graph.replace(newNode);
            }
            previousClosest = closesPointIndex[i];

            relevantNodes[i] = relevantNodes[i].move(points[closesPointIndex[i]]);
            graph = graph.replace(relevantNodes[i]);

            newNodes.push(relevantNodes[i]);
        }

        // place the key points on the best point of the new line
        for (i = 1; i < relevantNodes.length - 1; i++) {
            var n = relevantNodes[i];

            if (closesPointIndex[i] === null && nodeInteresting(graph, n)) {
                var result = iD.geo.chooseEdge(newNodes, projection(n.loc), projection);

                n = n.move(result.loc);
                graph = graph.replace(n);
                if (iD.geo.sphericalDistance(newNodes[result.index - 1].loc, result.loc) < 5 && !nodeInteresting(graph, newNodes[result.index - 1])) {
                    graph = iD.actions.DeleteNode(newNodes[result.index - 1].id)(graph);
                    newNodes[result.index - 1] = n;
                } else if (iD.geo.sphericalDistance(newNodes[result.index].loc, result.loc) < 5 && !nodeInteresting(graph, newNodes[result.index])) {
                    graph = iD.actions.DeleteNode(newNodes[result.index].id)(graph);
                    newNodes[result.index ] = n;
                } else {
                    newNodes.splice(result.index, 0, n);
                }
            }
        }

        // replace middle of th way  with new nodes
        allNodes.splice.apply(allNodes, [relevantStartIndex, relevantEndIndex - relevantStartIndex + 1].concat(newNodes));

        // set the complete list of node ids of the way
        newNodeIds = allNodes.map(function(n) { return n.id; });
        return graph.replace(way.update({nodes: newNodeIds}));
    };

    return action;
};
