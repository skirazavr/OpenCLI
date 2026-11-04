import { lstat, readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

export interface ProjectContextOptions {
    rootDirectory?: string;
    maxFileSize?: number;
    maxSearchResults?: number;
    maxFilesToSearch?: number;
    maxDirectoryEntries?: number;
    maxSearchDepth?: number;
}

export interface DirectoryEntry {
    name: string;
    type: "file" | "directory" | "other";
}

export interface SearchResult {
    file: string;
    line: number;
    content: string;
}

const IGNORED_DIRECTORIES = new Set([
    "node_modules",
    ".git",
    ".idea",
    ".vscode",
    ".next",
    ".nuxt",
    ".angular",
    "dist",
    "build",
    "coverage",
    "target",
    "bin",
    "obj",
    "out",
    "vendor",
    "__pycache__",
    ".gradle",
    ".cache"
]);
const CONTEXT_FILES = [
    "package.json",
    "tsconfig.json",
    "README.md",
    "README",
    "build.gradle",
    "build.gradle.kts",
    "settings.gradle",
    "settings.gradle.kts",
    "pom.xml",
    "Cargo.toml",
    "go.mod",
    "pyproject.toml",
    "requirements.txt",
    "composer.json",
    "Gemfile"
];

export class ProjectContext {
    private readonly rootDirectory: string;
    private readonly maxFileSize: number;
    private readonly maxSearchResults: number;
    private readonly maxFilesToSearch: number;
    private readonly maxDirectoryEntries: number;
    private readonly maxSearchDepth: number;
    private rootRealPathPromise: Promise<string> | null = null;

    constructor(options: ProjectContextOptions = {}) {
        this.rootDirectory = path.resolve(options.rootDirectory ?? process.cwd());
        this.maxFileSize = options.maxFileSize ?? 100_000;
        this.maxSearchResults = options.maxSearchResults ?? 100;
        this.maxFilesToSearch = options.maxFilesToSearch ?? 5_000;
        this.maxDirectoryEntries = options.maxDirectoryEntries ?? 500;
        this.maxSearchDepth = options.maxSearchDepth ?? 8;
    }

    async getProjectOverview(): Promise<string> {
        const root = await this.getRealRoot();
        const rootEntries = await this.listDirectory(".");
        const sections: string[] = [
            `PROJECT ROOT: ${root}`,
            "",
            "ROOT DIRECTORY:",
            rootEntries
        ];
        const metadataFiles = await this.findContextFiles();

        for (const file of metadataFiles) {
            try {
                const content = await this.readFile(file, 12_000);

                sections.push(
                    "",
                    `FILE: ${file}`,
                    "```",
                    content,
                    "```"
                );
            } catch {
            }
        }

        return sections.join("\n");
    }

    async listDirectory(relativePath = "."): Promise<string> {
        const absolutePath = await this.resolveExistingPath(relativePath);
        const directoryStat = await stat(absolutePath);

        if (!directoryStat.isDirectory()) {
            throw new Error(`Path is not a directory: ${relativePath}`);
        }

        const entries = await readdir(absolutePath, {
            withFileTypes: true
        });

        const visibleEntries: DirectoryEntry[] = [];

        for (const entry of entries) {
            if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
                continue;
            }

            let type: DirectoryEntry["type"] = "other";

            if (entry.isFile()) {
                type = "file";
            } else if (entry.isDirectory()) {
                type = "directory";
            }

            visibleEntries.push({
                name: entry.name,
                type
            });
        }

        visibleEntries.sort((a, b) => {
            if (a.type === "directory" && b.type !== "directory") {
                return -1;
            }

            if (a.type !== "directory" && b.type === "directory") {
                return 1;
            }

            return a.name.localeCompare(b.name);
        });

        const limitedEntries = visibleEntries.slice(
            0,
            this.maxDirectoryEntries
        );
        const formatted = limitedEntries.map(entry => {
            const suffix = entry.type === "directory" ? "/" : "";

            return `${entry.name}${suffix}`;
        });

        if (visibleEntries.length > this.maxDirectoryEntries) {
            formatted.push(`... ${visibleEntries.length - this.maxDirectoryEntries} more entries omitted`);
        }

        return [
            `DIRECTORY: ${relativePath}`,
            `ENTRIES: ${visibleEntries.length}`,
            "",
            ...formatted
        ].join("\n");
    }

    async readFile(relativePath: string, maxCharacters = this.maxFileSize): Promise<string> {
        const absolutePath = await this.resolveExistingPath(relativePath);
        const fileName = path.basename(absolutePath).toLowerCase();

        if (fileName === ".env" || fileName.startsWith(".env.") || fileName.endsWith(".pem") || fileName.endsWith(".key")) {
            throw new Error(`Access to sensitive file is denied: ${relativePath}`);
        }

        const fileStat = await stat(absolutePath);

        if (!fileStat.isFile()) {
            throw new Error(`Path is not a file: ${relativePath}`);
        }

        if (fileStat.size > this.maxFileSize * 4) {
            throw new Error(`File is too large to read: ${relativePath}`);
        }

        const content = await readFile(absolutePath, "utf8");
        const limit = Math.max(1, Math.min(maxCharacters, this.maxFileSize));

        if (content.length <= limit) {
            return content;
        }

        return [
            content.slice(0, limit),
            "",
            `[Content truncated. Original size: ${content.length} characters.]`
        ].join("\n");
    }

    async searchFiles(
        query: string,
        options: {
            extensions?: string[];
            maxResults?: number;
            maxFiles?: number;
        } = {}
    ): Promise<string> {
        const normalizedQuery = query.trim().toLowerCase();

        if (normalizedQuery.length === 0) {
            throw new Error("Search query cannot be empty");
        }

        const maxResults = Math.max(1, Math.min(options.maxResults ?? this.maxSearchResults, this.maxSearchResults));
        const maxFiles = Math.max(1, Math.min(options.maxFiles ?? this.maxFilesToSearch, this.maxFilesToSearch));
        const extensions = options.extensions
            ? new Set(
                options.extensions.map(extension =>
                    extension.startsWith(".")
                        ? extension.toLowerCase()
                        : `.${extension.toLowerCase()}`
                )
            )
            : null;

        const results: SearchResult[] = [];

        let scannedFiles = 0;
        let reachedFileLimit = false;

        const root = await this.getRealRoot();
        const walk = async (directory: string, depth: number): Promise<void> => {
            if (depth > this.maxSearchDepth || results.length >= maxResults || reachedFileLimit) {
                return;
            }

            const entries = await readdir(directory, {
                withFileTypes: true
            });

            for (const entry of entries) {
                if (results.length >= maxResults || reachedFileLimit) {
                    return;
                }

                if (entry.isSymbolicLink() || entry.name === ".env" || entry.name.startsWith(".env.")) {
                    continue;
                }

                const absolutePath = path.join(directory, entry.name);

                if (entry.isDirectory()) {
                    if (IGNORED_DIRECTORIES.has(entry.name)) {
                        continue;
                    }

                    await walk(absolutePath, depth + 1);

                    continue;
                }

                if (!entry.isFile()) {
                    continue;
                }

                if (extensions) {
                    const extension = path.extname(entry.name).toLowerCase();

                    if (!extensions.has(extension)) {
                        continue;
                    }
                }

                scannedFiles++;

                if (scannedFiles > maxFiles) {
                    reachedFileLimit = true;

                    return;
                }

                try {
                    const fileStat = await stat(absolutePath);

                    if (!fileStat.isFile() || fileStat.size > this.maxFileSize * 4) {
                        continue;
                    }

                    const content = await readFile(
                        absolutePath,
                        "utf8"
                    );

                    if (content.includes("\0")) {
                        continue;
                    }

                    const lines = content.split(/\r?\n/);

                    for (let index = 0; index < lines.length; index++) {
                        if (lines[index].toLowerCase().includes(normalizedQuery)) {
                            const relativeFile = path
                                .relative(root, absolutePath)
                                .split(path.sep)
                                .join("/");

                            results.push({
                                file: relativeFile,
                                line: index + 1,
                                content: lines[index].trim()
                            });

                            if (results.length >= maxResults) {
                                return;
                            }
                        }
                    }
                } catch {
                }
            }
        };

        await walk(root, 0);

        if (results.length === 0) {
            return [
                `SEARCH QUERY: ${query}`,
                "",
                "No matching results found",
                `Files scanned: ${Math.min(scannedFiles, maxFiles)}`
            ].join("\n");
        }

        const output = [
            `SEARCH QUERY: ${query}`,
            `RESULTS: ${results.length}`,
            `FILES SCANNED: ${Math.min(scannedFiles, maxFiles)}`,
            ""
        ];

        for (const result of results) {
            output.push(
                `${result.file}:${result.line}`,
                `  ${result.content}`,
                ""
            );
        }

        if (reachedFileLimit) {
            output.push(`Search stopped after reaching the ${maxFiles} file limit.`);
        }

        if (results.length >= maxResults) {
            output.push(`Result limit reached: ${maxResults}.`);
        }

        return output.join("\n");
    }

    private async findContextFiles(): Promise<string[]> {
        const root = await this.getRealRoot();
        const entries = await readdir(root, {
            withFileTypes: true
        });
        const availableFiles = new Set(entries.filter(entry => entry.isFile()).map(entry => entry.name));
        const result = CONTEXT_FILES.filter(file => availableFiles.has(file));

        for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith(".csproj")) {
                result.push(entry.name);
            }
        }

        return result;
    }

    private async resolveExistingPath(relativePath: string): Promise<string> {
        if (typeof relativePath !== "string" || relativePath.trim().length === 0) {
            throw new Error("Path cannot be empty");
        }

        if (path.isAbsolute(relativePath)) {
            throw new Error("Absolute paths are not allowed");
        }

        const normalizedPath = path.normalize(relativePath);
        const root = await this.getRealRoot();
        const candidate = path.resolve(root, normalizedPath);

        if (!this.isInsideRoot(root, candidate)) {
            throw new Error("Access outside the project directory is not allowed");
        }

        const relative = path.relative(root, candidate);

        let currentPath = root;

        const components = relative.split(path.sep).filter(Boolean);

        for (const component of components) {
            currentPath = path.join(currentPath, component);

            const currentStat = await lstat(currentPath);

            if (currentStat.isSymbolicLink()) {
                throw new Error(`Symbolic links are not allowed: ${component}`);
            }
        }

        const resolved = await realpath(candidate);

        if (!this.isInsideRoot(root, resolved)) {
            throw new Error("Resolved path is outside the project directory");
        }

        return resolved;
    }

    private async getRealRoot(): Promise<string> {
        if (!this.rootRealPathPromise) {
            this.rootRealPathPromise = realpath(this.rootDirectory);
        }

        return this.rootRealPathPromise;
    }

    private isInsideRoot(root: string, target: string): boolean {
        const relative = path.relative(root, target);

        return (relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)));
    }
}