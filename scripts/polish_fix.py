from pathlib import Path

root = Path(__file__).resolve().parents[1]


def main() -> None:
    shell = (root / "src/components/layout/Shell.tsx").read_text(encoding="utf-8")
    shell = "\n".join(
        "      { duration: 6000 }" if "duration: 6000, icon:" in line else line
        for line in shell.splitlines()
    ) + "\n"
    shell = shell.replace(
        '<motion.div className="w-10 h-10 shrink-0 rounded-xl bg-brand-gold/10 flex items-center justify-center font-bold text-brand-gold border border-brand-gold/20 transition-transform group-hover:scale-105">',
        '<div className="w-10 h-10 shrink-0 rounded-xl bg-brand-gold/10 flex items-center justify-center font-bold text-brand-gold border border-brand-gold/20 transition-transform group-hover:scale-105">',
    )
    shell = shell.replace(
        '        <div className="bg-brand-blue/5 py-3 px-10 flex items-center justify-between">',
        '        <div className="bg-brand-blue/5 py-3 px-10 flex items-center min-w-0">',
    )
    shell = shell.replace(
        '          <div className="flex items-center gap-3">\n'
        '             <div className="w-1.5 h-5 rounded-full bg-brand-gold animate-pulse" />\n'
        '             <p className="text-[10px] text-brand-blue font-bold uppercase tracking-widest">',
        '          <div className="flex items-center gap-3 min-w-0 flex-1">\n'
        '             <div className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse shrink-0" />\n'
        '             <p className="text-[10px] text-brand-blue font-bold uppercase tracking-widest truncate">',
    )
    shell = shell.replace(
        '          <div className="flex items-center gap-3">\n'
        '             <div classXName="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse" />\n'
        '             <p className="text-[10px] text-brand-blue font-bold uppercase tracking-widest">',
        '          <div className="flex items-center gap-3 min-w-0 flex-1">\n'
        '             <div className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse shrink-0" />\n'
        '             <p className="text-[10px] text-brand-blue font-bold uppercase tracking-widest truncate">',
    )
    # fallback if first status block didn't match
    if "justify-between" in shell and "bg-brand-blue/5 py-3" in shell:
        shell = shell.replace(
            '        <div className="bg-brand-blue/5 py-3 px-10 flex items-center justify-between">',
            '        <div className="bg-brand-blue/5 py-3 px-10 flex items-center min-w-0">',
        )
    if 'tracking-widest">' in shell and "tracking-widest truncate" not in shell:
        shell = shell.replace(
            '             <p className="text-[10px] text-brand-blue font-bold uppercase tracking-widest">',
            '             <p className="text-[10px] text-brand-blue font-bold uppercase tracking-widest truncate">',
            1,
        )
    if "gap-3 min-w-0" not in shell:
        shell = shell.replace(
            '          <div className="flex items-center gap-3">',
            '          <div className="flex items-center gap-3 min-w-0 flex-1">',
            1,
        )
    (root / "src/components/layout/Shell.tsx").write_text(shell, encoding="utf-8")

    admin = (root / "src/pages/dayAdminDashboard.tsx").read_text(encoding="utf-8")
