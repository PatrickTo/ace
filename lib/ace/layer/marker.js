/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2010, Ajax.org B.V.
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Ajax.org B.V. nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL AJAX.ORG B.V. BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * ***** END LICENSE BLOCK ***** */

define(function(require, exports, module) {
"use strict";

var Range = require("../range").Range;
var dom = require("../lib/dom");
var lang = require("../lib/lang");

var Marker = function(parentEl) {
    this.element = dom.createElement("div");
    this.element.className = "ace_layer ace_marker-layer";
    parentEl.appendChild(this.element);
};

(function() {

    this.$padding = 0;

    this.setPadding = function(padding) {
        this.$padding = padding;
    };
    this.setSession = function(session) {
        this.session = session;
    };
    
    this.setMarkers = function(markers) {
        this.markers = markers;
    };

    this.update = function(config) {
        var config = config || this.config;
        if (!config)
            return;

        this.config = config;


        var html = [];
        for (var key in this.markers) {
            var marker = this.markers[key];

            if (!marker.range) {
                marker.update(html, this, this.session, config);
                continue;
            }

            var range = marker.range.clipRows(config.firstRow, config.lastRow);
            if (range.isEmpty()) continue;

            range = range.toScreenRange(this.session);
            if (marker.renderer) {
                var top = this.$getTop(range.start.row, config);
                var line = this.session.getScreenLine(range.start.row);
                var textWidth = this.session.$getTextWidth(line.substring(0, range.start.column));
                var left = this.$padding + textWidth;
                marker.renderer(html, range, left, top, config);
            } else if (marker.type == "fullLine") {
                this.drawFullLineMarker(html, range, marker.clazz, config);
            } else if (marker.type == "screenLine") {
                this.drawScreenLineMarker(html, range, marker.clazz, config);
            } else if (range.isMultiLine()) {
                if (marker.type == "text")
                    this.drawTextMarker(html, range, marker.clazz, config);
                else
                    this.drawMultiLineMarker(html, range, marker.clazz, config);
            } else {
                this.drawSingleLineMarker(html, range, marker.clazz + " ace_start" + " ace_br15", config);
            }
        }
        this.element.innerHTML = html.join("");
    };

    this.$getTop = function(row, layerConfig) {
        return (row - layerConfig.firstRowScreen) * layerConfig.lineHeight;
    };

    function getBorderClass(tl, tr, br, bl) {
        return (tl ? 1 : 0) | (tr ? 2 : 0) | (br ? 4 : 0) | (bl ? 8 : 0);
    }
    // Draws a marker, which spans a range of text on multiple lines 
    this.drawTextMarker = function(stringBuilder, range, clazz, layerConfig, extraStyle) {
        var session = this.session;
        var start = range.start.row;
        var end = range.end.row;
        var row = start;
        var prev = 0; 
        var curr = 0;
        var next = session.getScreenLastRowColumn(row);
        var lineRange = new Range(row, range.start.column, row, curr);
        for (; row <= end; row++) {
            lineRange.start.row = lineRange.end.row = row;
            lineRange.start.column = row == start ? range.start.column : session.getRowWrapIndent(row);
            lineRange.end.column = next;
            if (lineRange.start.column == lineRange.end.column) {
                lineRange.end.column++;
                end = row;
            }
            prev = curr;
            curr = next;
            next = row + 1 < end ? session.getScreenLastRowColumn(row + 1) : row == end ? 0 : range.end.column;
            this.drawSingleLineMarker(stringBuilder, lineRange, 
                clazz + (row == start  ? " ace_start" : "") + " ace_br"
                    + getBorderClass(row == start || row == start + 1 && range.start.column, prev < curr, curr > next, row == end),
                layerConfig, row == end ? 0 : 1, extraStyle);
        }
    };

    // Draws a multi line marker, where lines span the full width
    this.drawMultiLineMarker = function(stringBuilder, range, clazz, config, extraStyle) {
        // from selection start to the end of the line
        var padding = this.$padding;
        
        var line = this.session.getScreenLine(range.start.row);
        var startRange = new Range(range.start.row, range.start.column, range.start.row, line.length);
        this.drawSingleLineMarker(stringBuilder, startRange, clazz+" ace_br1 ace_start", config, 0, extraStyle);

        // from start of the last line to the selection end
        var endRange = new Range(range.end.row, 0, range.end.row, range.end.column);
        this.drawSingleLineMarker(stringBuilder, endRange, clazz+" ace_br12", config, 0, extraStyle);

        // all the complete lines
        var height = (range.end.row - range.start.row - 1) * config.lineHeight;
        if (height <= 0)
            return;
        var top = this.$getTop(range.start.row + 1, config);
        
        var radiusClass = (range.start.column ? 1 : 0) | (range.end.column ? 0 : 8);

        stringBuilder.push(
            "<div class='", clazz, (radiusClass ? " ace_br" + radiusClass : ""), "' style='",
            "height:", height, "px;",
            "right:0;",
            "top:", top, "px;",
            "left:", padding, "px;", extraStyle, "'></div>"
        );
    };

    // Draws a marker which covers part or whole width of a single screen line
    this.drawSingleLineMarker = function(stringBuilder, range, clazz, config, extraLength, extraStyle) {
        var height = config.lineHeight;
        var line = this.session.getScreenLine(range.start.row);
        var top = this.$getTop(range.start.row, config);
        var visualGroups = lang.getVisualGroups(line, range.start.column, range.end.column - 1);
        for (var i = 0; i < visualGroups.length; i++) {
            var endColumn = i < visualGroups.length - 1 ? visualGroups[i + 1].pos : range.end.column;
            var width = this.session.$getTextWidth(line.substring(visualGroups[i].pos, endColumn));

            if (visualGroups[i].type === "ltr")
                var leftOffset = this.session.$getTextWidth(line.substring(0, visualGroups[i].pos));
            else {
                var rtlBoundary = lang.getRtlBoundary(line, visualGroups[i].pos);
                var leftOffset = this.session.$getTextWidth(line.substring(0, rtlBoundary[0])) + 
                    this.session.$getTextWidth(line.substring(endColumn - 1, rtlBoundary[1]));
            }
            var left = this.$padding + leftOffset;

            stringBuilder.push(
                "<div class='", clazz, "' style='",
                "height:", height, "px;",
                "width:", width, "px;",
                "top:", top, "px;",
                "left:", left, "px;", extraStyle || "", "'></div>"
            );
        }
    };

    this.drawFullLineMarker = function(stringBuilder, range, clazz, config, extraStyle) {
        var top = this.$getTop(range.start.row, config);
        var height = config.lineHeight;
        if (range.start.row != range.end.row)
            height += this.$getTop(range.end.row, config) - top;

        stringBuilder.push(
            "<div class='", clazz, "' style='",
            "height:", height, "px;",
            "top:", top, "px;",
            "left:0;right:0;", extraStyle || "", "'></div>"
        );
    };
    
    this.drawScreenLineMarker = function(stringBuilder, range, clazz, config, extraStyle) {
        var top = this.$getTop(range.start.row, config);
        var height = config.lineHeight;

        stringBuilder.push(
            "<div class='", clazz, "' style='",
            "height:", height, "px;",
            "top:", top, "px;",
            "left:0;right:0;", extraStyle || "", "'></div>"
        );
    };

}).call(Marker.prototype);

exports.Marker = Marker;

});
