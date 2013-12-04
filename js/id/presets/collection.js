iD.presets.Collection = function(collection) {

    var maxSearchResults = 50,
        maxSuggestionResults = 10;

    var presets = {

        collection: collection,

        item: function(id) {
            return _.find(collection, function(d) {
                return d.id === id;
            });
        },

        matchGeometry: function(geometry) {
            return iD.presets.Collection(collection.filter(function(d) {
                return d.matchGeometry(geometry);
            }));
        },

        search: function(value, geometry) {
            if (!value) return this;

            value = value.toLowerCase();

            var searchable = _.filter(collection, function(a) {
                return a.searchable !== false && a.suggestion !== true;
            }),
            suggestions = _.filter(collection, function(a) {
                return a.suggestion === true;
            });

            // matches value to preset.name
            var leading_name = _.filter(searchable, function(a) {
                    return leading(a.name().toLowerCase());
                });

            // matches value to preset.terms values
            var leading_terms = _.filter(searchable, function(a) {
                return _.any(a.terms() || [], leading);
            });

            var leading_suggestions = _.filter(suggestions, function(a) {
                    return leading(suggestionName(a.name()));
                });

            var theLead = leading_name.concat(
                    leading_terms,
                    leading_suggestions
                ).sort(function(a, b) {
                    var aName = a.suggestion? suggestionName(a.name()) : a.name(),
                        bName = b.suggestion? suggestionName(b.name()) : b.name();
                    var i = aName.toLowerCase().indexOf(value) - bName.toLowerCase().indexOf(value);
                    if (i === 0) return aName.length - bName.length;
                    else return i;
                });

            function leading(a) {
                var index = a.indexOf(value);
                return index === 0 || a[index - 1] === ' ';
            }

            // finds close matches to value in preset.name
            var levenstein_name = searchable.map(function(a) {
                    return {
                        preset: a,
                        dist: iD.util.editDistance(value, a.name().toLowerCase())
                    };
                }).filter(function(a) {
                    return a.dist + Math.min(value.length - a.preset.name().length, 0) < 3;
                }).sort(function(a, b) {
                    return a.dist - b.dist;
                }).map(function(a) {
                    return a.preset;
                });

            // finds close matches to value in preset.terms
            var leventstein_terms = _.filter(searchable, function(a) {
                    return _.any(a.terms() || [], function(b) {
                        return iD.util.editDistance(value, b) + Math.min(value.length - b.length, 0) < 3;
                    });
                });

            function suggestionName(name) {
                var nameArray = name.split(' - ');
                if (nameArray.length > 1) {
                    name = nameArray.slice(0, nameArray.length-1).join(' - ');
                }
                return name.toLowerCase();
            }

            var leven_suggestions = suggestions.map(function(a) {
                    return {
                        preset: a,
                        dist: iD.util.editDistance(value, suggestionName(a.name()))
                    };
                }).filter(function(a) {
                    return a.dist + Math.min(value.length - suggestionName(a.preset.name()).length, 0) < 1;
                }).sort(function(a, b) {
                    return a.dist - b.dist;
                }).map(function(a) {
                    return a.preset;
                });

            var other = presets.item(geometry);

            var results = theLead.concat(
                            levenstein_name,
                            leventstein_terms,
                            leven_suggestions.slice(0, maxSuggestionResults)
                        ).slice(0, maxSearchResults-1);

            return iD.presets.Collection(_.unique(
                    results.concat(other)
                ));
        }
    };

    return presets;
};
