package com.alamin.pos.domain.enums;

public enum Location {
    DOKAN,
    GODOWN,
    QUARANTINE;

    public static boolean isValid(String val) {
        if (val == null) return false;
        for (Location loc : values()) {
            if (loc.name().equalsIgnoreCase(val.trim())) return true;
        }
        return false;
    }
}
