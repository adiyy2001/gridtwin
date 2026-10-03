export interface paths {
    "/api/cases": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CaseSummaryDto"][];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/cases/{caseId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    caseId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CaseDetailDto"];
                    };
                };
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorDto"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateSession"];
                };
            };
            responses: {
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SessionCreatedDto"];
                    };
                };
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sessions/{sessionId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    sessionId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sessions/{sessionId}/analyses/cascade": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    sessionId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CascadeDto"];
                    };
                };
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorDto"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    sessionId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["RunCascade"];
                };
            };
            responses: {
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CascadeDto"];
                    };
                };
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sessions/{sessionId}/analyses/n-1": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    sessionId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ContingencyReportDto"];
                    };
                };
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorDto"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    sessionId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ContingencyReportDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sessions/{sessionId}/analyses/n-1/{contingencyId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    contingencyId: string;
                    sessionId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ContingencyPreviewDto"];
                    };
                };
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorDto"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sessions/{sessionId}/load-factor": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    sessionId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["SetLoadFactor"];
                };
            };
            responses: {
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["VersionedStateDto"];
                    };
                };
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorDto"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sessions/{sessionId}/state": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    sessionId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["VersionedStateDto"];
                    };
                };
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorDto"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sessions/{sessionId}/switches/{switchId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    sessionId: string;
                    switchId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["OperateSwitch"];
                };
            };
            responses: {
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["VersionedStateDto"];
                    };
                };
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorDto"];
                    };
                };
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        BayDto: {
            id: string;
            name: string;
            kind: components["schemas"]["BayKind"];
            column: number;
            terminal?: components["schemas"]["TerminalDto"] | null;
        };
        BayKind: "FEEDER" | "COUPLER";
        BranchStateDto: {
            id: string;
            from: number;
            to: number;
            inService: boolean;
            energized: boolean;
            ratingMva: number;
            activeFromMw: number;
            reactiveFromMvar: number;
            activeToMw: number;
            reactiveToMvar: number;
            currentFromKa: number;
            currentToKa: number;
            loading: number;
            lossMw: number;
            overloaded: boolean;
        };
        BusState: "ENERGIZED" | "DEENERGIZED" | "COLLAPSED";
        BusStateDto: {
            number: number;
            type: components["schemas"]["BusType"];
            state: components["schemas"]["BusState"];
            baseKv: number;
            voltageMagnitude: number;
            voltageKv: number;
            angleDegrees: number;
            activeGenerationMw: number;
            reactiveGenerationMvar: number;
            activeLoadMw: number;
            reactiveLoadMvar: number;
        };
        BusType: "PQ" | "PV" | "REFERENCE" | "ISOLATED";
        BusbarDto: {
            node: string;
            bus: number;
            name: string;
            row: number;
        };
        CascadeDto: {
            stateVersion: number;
            tripThreshold: number;
            end: components["schemas"]["CascadeEnd"];
            trippedCount: number;
            label: string;
            steps: components["schemas"]["CascadeStepDto"][];
        };
        CascadeEnd: "STABLE" | "BLACKOUT" | "NON_CONVERGED" | "STEP_LIMIT";
        CascadeStepDto: {
            index: number;
            tripped?: components["schemas"]["OutageDto"] | null;
            loadingAtTrip?: number | null;
            outOfServiceBranches: string[];
            outOfServiceGenerators: string[];
            servedLoadMw: number;
            state: components["schemas"]["StateDto"];
        };
        CaseBranchDto: {
            id: string;
            from: number;
            to: number;
            ratingMva: number;
            tap: number;
            shiftDegrees: number;
            transformer: boolean;
        };
        CaseBusDto: {
            number: number;
            type: components["schemas"]["BusType"];
            baseKv: number;
            voltageMin: number;
            voltageMax: number;
            x?: number | null;
            y?: number | null;
        };
        CaseDetailDto: {
            id: string;
            title: string;
            disclaimer: string;
            baseMva: number;
            provenance: components["schemas"]["ProvenanceDto"];
            buses: components["schemas"]["CaseBusDto"][];
            branches: components["schemas"]["CaseBranchDto"][];
            generators: components["schemas"]["CaseGeneratorDto"][];
            loads: components["schemas"]["CaseLoadDto"][];
            substation?: components["schemas"]["SubstationDto"] | null;
        };
        CaseGeneratorDto: {
            id: string;
            bus: number;
            activeMinMw: number;
            activeMaxMw: number;
            activeMw: number;
        };
        CaseLoadDto: {
            bus: number;
            activeMw: number;
            reactiveMvar: number;
        };
        CaseSummaryDto: {
            id: string;
            title: string;
            buses: number;
            branches: number;
            generators: number;
        };
        ContingencyPreviewDto: {
            stateVersion: number;
            contingency: components["schemas"]["ContingencySummaryDto"];
            state: components["schemas"]["StateDto"];
        };
        ContingencyReportDto: {
            stateVersion: number;
            loadFactor: number;
            baseSeverity: components["schemas"]["SeverityDto"];
            baseViolations: components["schemas"]["ViolationDto"][];
            tiers: components["schemas"]["TierCountsDto"];
            contingencies: components["schemas"]["ContingencySummaryDto"][];
        };
        ContingencySummaryDto: {
            rank: number;
            id: string;
            outage: components["schemas"]["OutageDto"];
            severity: components["schemas"]["SeverityDto"];
            converged: boolean;
            maxLoading: number;
            lowestVoltage?: number | null;
            shedLoadMw: number;
            overloadedBranches: string[];
            violations: components["schemas"]["ViolationDto"][];
        };
        CreateSession: {
            caseId?: string | null;
        };
        ErrorDto: {
            code: string;
            message: string;
            switchId?: string | null;
        };
        GeneratorStateDto: {
            id: string;
            bus: number;
            inService: boolean;
            activeMw: number;
            reactiveMvar: number;
            reactiveLimit: components["schemas"]["ReactiveLimitState"];
        };
        IslandState: "ENERGIZED" | "COLLAPSED" | "DEENERGIZED";
        IslandStateDto: {
            id: string;
            state: components["schemas"]["IslandState"];
            buses: number[];
            slackBus?: number | null;
            slackGenerator?: string | null;
            shedLoadMw: number;
            iterations?: number | null;
            reactiveLimitRounds?: number | null;
            collapseReason?: string | null;
            mismatchHistory: number[];
        };
        NodeState: "ENERGIZED" | "DEENERGIZED" | "EARTHED";
        NodeStateDto: {
            id: string;
            state: components["schemas"]["NodeState"];
        };
        OperateSwitch: {
            position: components["schemas"]["Position"];
        };
        OutageDto: {
            id: string;
            kind: components["schemas"]["OutageKind"];
            equipmentId: string;
        };
        OutageKind: "BRANCH" | "GENERATOR";
        Position: "OPEN" | "CLOSED";
        ProvenanceDto: {
            source: string;
            ratingPolicy: string;
            voltagePolicy: string;
            layoutPolicy: string;
        };
        ReactiveLimitState: "NONE" | "UPPER" | "LOWER";
        RunCascade: {
            trigger: string;
            tripThreshold?: number | null;
            maxSteps?: number | null;
        };
        SessionCreatedDto: {
            sessionId: string;
            createdAt: components["schemas"]["ZonedDateTime"];
            state: components["schemas"]["VersionedStateDto"];
        };
        SetLoadFactor: {
            loadFactor: number;
        };
        SeverityDto: {
            tier: components["schemas"]["SeverityTier"];
            score: number;
            overloadTerm: number;
            voltageTerm: number;
            shedTerm: number;
            slackTerm: number;
        };
        SeverityTier: "SECURE" | "DEGRADED" | "BLACKOUT" | "NON_CONVERGED";
        StateDto: {
            caseId: string;
            loadFactor: number;
            converged: boolean;
            summary: components["schemas"]["SummaryStateDto"];
            warnings: string[];
            switches: components["schemas"]["SwitchStateDto"][];
            nodes: components["schemas"]["NodeStateDto"][];
            islands: components["schemas"]["IslandStateDto"][];
            buses: components["schemas"]["BusStateDto"][];
            branches: components["schemas"]["BranchStateDto"][];
            generators: components["schemas"]["GeneratorStateDto"][];
        };
        SubstationDto: {
            id: string;
            name: string;
            bus: number;
            baseKv: number;
            busbars: components["schemas"]["BusbarDto"][];
            nodes: string[];
            bays: components["schemas"]["BayDto"][];
            switches: components["schemas"]["SwitchDto"][];
        };
        SummaryStateDto: {
            totalLoadMw: number;
            servedLoadMw: number;
            shedLoadMw: number;
            totalGenerationMw: number;
            totalLossMw: number;
            maxLoading: number;
            lowestVoltage?: number | null;
            overloadedBranches: number;
        };
        SwitchDto: {
            id: string;
            kind: components["schemas"]["SwitchKind"];
            bay: string;
            nodeA: string;
            nodeB: string;
            initialPosition: components["schemas"]["Position"];
        };
        SwitchKind: "BREAKER" | "DISCONNECTOR" | "EARTHING_SWITCH";
        SwitchStateDto: {
            id: string;
            position: components["schemas"]["Position"];
        };
        TerminalDto: {
            node: string;
            kind: components["schemas"]["TerminalKind"];
            equipment: string;
        };
        TerminalKind: "BRANCH" | "LOAD" | "GENERATOR";
        TierCountsDto: {
            secure: number;
            degraded: number;
            blackout: number;
            nonConverged: number;
        };
        VersionedStateDto: {
            version: number;
            state: components["schemas"]["StateDto"];
        };
        ViolationDto: {
            kind: components["schemas"]["ViolationKind"];
            subject: string;
            value: number;
            limit?: number | null;
            side?: string | null;
        };
        ViolationKind: "BRANCH_OVERLOAD" | "VOLTAGE_OUT_OF_BAND" | "SLACK_ABOVE_LIMIT" | "LOAD_SHED" | "ISLAND_COLLAPSE";
        ZonedDateTime: string;
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
